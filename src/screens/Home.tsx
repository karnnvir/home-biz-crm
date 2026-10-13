import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { parseVoiceCommand } from "../lib/voiceParse";
import { ensurePushRegistered } from "../lib/push";
import {
  createOrder,
  findOrCreateCustomer,
  periodPaymentSummary,
  runQuery,
  subscribeCustomers,
  subscribeOrders,
  updateOrder,
} from "../lib/queries";
import { ConfirmCard } from "../components/ConfirmCard";
import { QueryResultCard } from "../components/QueryResultCard";
import { OrderRowBody } from "../components/OrderRow";
import type { Customer, Order, OrderDraft, ParsedCommand, Period, QueryResult } from "../types";

type Stage = "idle" | "listening" | "processing" | "confirming" | "saving";

const MONTH_KEY = /^\d{4}-\d{2}$/;

function monthOptionLabel(key: string): string {
  return new Date(key + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function periodValue(period: Period | null): string {
  if (!period) return "current";
  if (period.month) return `m:${period.year}-${String(period.month).padStart(2, "0")}`;
  return `y:${period.year}`;
}

function periodFromValue(value: string): Period | null {
  if (value.startsWith("m:")) {
    const [year, month] = value.slice(2).split("-");
    return { year: Number(year), month: Number(month) };
  }
  if (value.startsWith("y:")) return { year: Number(value.slice(2)), month: null };
  return null;
}

function draftFromParsed(parsed: ParsedCommand, matchedName: string | null): OrderDraft {
  return {
    customerName: matchedName ?? parsed.customerName ?? "",
    items: parsed.items.length ? parsed.items : [{ name: "", quantity: 1, unit: null }],
    deliveryDate: parsed.deliveryDate ?? "",
    amount: parsed.amount,
    paid: parsed.paid ?? false,
    status: parsed.status ?? "pending",
  };
}

export function Home() {
  const { supported, listening, transcript, error, start, reset } = useSpeechRecognition();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [typedText, setTypedText] = useState("");
  const [showTypeBox, setShowTypeBox] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [matchedOrderId, setMatchedOrderId] = useState<string | null>(null);
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);

  useEffect(() => subscribeCustomers(setCustomers), []);
  useEffect(() => subscribeOrders(setOrders), []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      ensurePushRegistered();
    }
  }, []);

  const resetFlow = () => {
    setStage("idle");
    setDraft(null);
    setMatchedOrderId(null);
    setMatchedCustomerId(null);
    setQueryResult(null);
    setClarification(null);
    setParseError(null);
    reset();
    setTypedText("");
  };

  const handleTranscript = async (text: string) => {
    setStage("processing");
    setParseError(null);
    setClarification(null);
    try {
      const parsed = await parseVoiceCommand(text, customers, orders);

      if (parsed.intent === "unknown" || (!parsed.customerName && parsed.intent !== "query")) {
        setClarification(
          parsed.clarification ?? "Didn't quite catch that. Try again, or type it instead."
        );
        setStage("idle");
        return;
      }

      if (parsed.intent === "query" && parsed.queryType === "summary_for_period") {
        if (parsed.periodYear != null) {
          const now = new Date();
          const isCurrentMonth =
            parsed.periodMonth === now.getMonth() + 1 && parsed.periodYear === now.getFullYear();
          setPeriod(isCurrentMonth ? null : { year: parsed.periodYear, month: parsed.periodMonth });
        } else {
          setClarification("Which month or year did you mean?");
        }
        setStage("idle");
        return;
      }

      if (parsed.intent === "query" && parsed.queryType) {
        const queriedPeriod =
          parsed.periodYear != null ? { year: parsed.periodYear, month: parsed.periodMonth } : undefined;
        const result = await runQuery(parsed.queryType, parsed.queryValue, queriedPeriod);
        setQueryResult(result);
        setStage("idle");
        return;
      }

      const matchedName = parsed.matchedCustomerId
        ? customers.find((c) => c.id === parsed.matchedCustomerId)?.name ?? null
        : null;

      if (parsed.intent === "update_order" && parsed.matchedOrderId) {
        const existing = orders.find((o) => o.id === parsed.matchedOrderId);
        if (existing) {
          setDraft({
            customerName: existing.customerName,
            items: parsed.items.length
              ? parsed.items
              : existing.items.map((i) => ({ ...i, unit: i.unit ?? null })),
            deliveryDate: parsed.deliveryDate ?? existing.deliveryDate,
            amount: parsed.amount ?? existing.amount,
            paid: parsed.paid ?? existing.paid,
            status: parsed.status ?? existing.status,
          });
          setMatchedOrderId(existing.id);
          setStage("confirming");
          return;
        }
      }

      setDraft(draftFromParsed(parsed, matchedName));
      setMatchedCustomerId(parsed.matchedCustomerId);
      setStage("confirming");
    } catch (err) {
      console.error(err);
      setParseError("Something went wrong understanding that. Try again, or type it instead.");
      setStage("idle");
    }
  };

  const handleMicPress = () => {
    resetFlow();
    setStage("listening");
    start((finalTranscript) => handleTranscript(finalTranscript));
  };

  const handleTypedSubmit = () => {
    if (!typedText.trim()) return;
    handleTranscript(typedText.trim());
  };

  const handleConfirm = async () => {
    if (!draft) return;
    setStage("saving");
    try {
      if (matchedOrderId) {
        await updateOrder(matchedOrderId, {
          customerName: draft.customerName,
          items: draft.items.filter((i) => i.name.trim()),
          deliveryDate: draft.deliveryDate,
          amount: draft.amount,
          paid: draft.paid,
          status: draft.status,
        });
      } else {
        const customerId =
          matchedCustomerId ?? (await findOrCreateCustomer(draft.customerName, customers));
        await createOrder({
          customerId,
          customerName: draft.customerName,
          items: draft.items.filter((i) => i.name.trim()),
          deliveryDate: draft.deliveryDate,
          amount: draft.amount,
          paid: draft.paid,
          status: draft.status,
        });
      }
      resetFlow();
    } catch (err) {
      console.error(err);
      setParseError("Couldn't save that — check your connection and try again.");
      setStage("confirming");
    }
  };

  const recentlyAdded = [...orders]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10);

  const monthSummary = useMemo(
    () => periodPaymentSummary(orders, period ?? undefined),
    [orders, period]
  );

  // Every month/year that actually has orders, plus the active period (which
  // voice can set to a month with no orders) so the dropdown never goes blank.
  const periodOptions = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const months = new Set<string>();
    const years = new Set<number>();
    for (const o of orders) {
      const key = o.deliveryDate?.slice(0, 7);
      if (key && MONTH_KEY.test(key)) {
        months.add(key);
        years.add(Number(key.slice(0, 4)));
      }
    }
    if (period?.month) months.add(`${period.year}-${String(period.month).padStart(2, "0")}`);
    if (period && !period.month) years.add(period.year);
    months.delete(currentKey);
    return {
      months: [...months].sort().reverse(),
      years: [...years].sort().reverse(),
    };
  }, [orders, period]);

  const micLabel = () => {
    if (stage === "listening") return "Listening… tap when you're done";
    if (stage === "processing") return "Got it — one sec…";
    if (!supported) return "Voice isn't supported here — type below instead";
    return "Just say it out loud";
  };

  return (
    <div className="screen">
      <div className="speak-banner">
        <div className="eyebrow">
          <span className="eyebrow-icon">🎙️</span>
          New order
        </div>
        <div className="headline">{micLabel()}</div>
        <div className="actions">
          <button
            className={`speak-btn ${stage === "listening" ? "listening" : ""}`}
            onClick={handleMicPress}
            disabled={stage === "processing" || stage === "saving"}
          >
            {stage === "listening" ? "⏺ Listening…" : "🎙 Speak order"}
          </button>
          <button
            className={`type-btn ${showTypeBox ? "active" : ""}`}
            onClick={() => setShowTypeBox((v) => !v)}
            aria-label="Type instead"
          >
            ⌨️
          </button>
        </div>
      </div>

      {listening && transcript && <div className="transcript-box">{transcript}</div>}

      {error && <div className="error-text">{error}</div>}
      {parseError && <div className="error-text">{parseError}</div>}
      {clarification && <div className="error-text">{clarification}</div>}

      {showTypeBox && (
        <div className="type-instead">
          <input
            autoFocus
            placeholder="…or type it here"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTypedSubmit()}
          />
          <button onClick={handleTypedSubmit}>Go</button>
        </div>
      )}

      {draft && (stage === "confirming" || stage === "saving") && (
        <ConfirmCard
          draft={draft}
          onChange={setDraft}
          onConfirm={handleConfirm}
          onCancel={resetFlow}
          isUpdate={!!matchedOrderId}
          saving={stage === "saving"}
        />
      )}

      {queryResult && <QueryResultCard result={queryResult} onClose={resetFlow} />}

      {!draft && !queryResult && (
        <div className="card">
          <div style={{ marginBottom: 10 }}>
            <select
              value={periodValue(period)}
              onChange={(e) => setPeriod(periodFromValue(e.target.value))}
              aria-label="Report period"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "var(--color-text)",
                maxWidth: "100%",
              }}
            >
              <option value="current">This month</option>
              {periodOptions.months.length > 0 && (
                <optgroup label="Previous months">
                  {periodOptions.months.map((key) => (
                    <option key={key} value={`m:${key}`}>
                      {monthOptionLabel(key)}
                    </option>
                  ))}
                </optgroup>
              )}
              {periodOptions.years.length > 0 && (
                <optgroup label="Full year">
                  {periodOptions.years.map((year) => (
                    <option key={year} value={`y:${year}`}>
                      {year} (full year)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#8a7d72", fontSize: 13 }}>Total</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>₹{monthSummary.total}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#8a7d72", fontSize: 13 }}>Received</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>₹{monthSummary.received}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#8a7d72", fontSize: 13 }}>Pending</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>₹{monthSummary.pending}</div>
            </div>
          </div>
          <div style={{ color: "#8a7d72", fontSize: 13 }}>
            {monthSummary.orderCount} order{monthSummary.orderCount === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {!draft && !queryResult && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Recently added</div>
          {recentlyAdded.length === 0 ? (
            <div className="empty-state">No orders yet. Tap the mic to add one.</div>
          ) : (
            recentlyAdded.map((order) => (
              <Link className="order-row" to={`/orders/${order.id}`} key={order.id}>
                <OrderRowBody order={order} showChevron />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
