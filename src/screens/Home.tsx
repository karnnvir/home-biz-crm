import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { parseVoiceCommand } from "../lib/voiceParse";
import { ensurePushRegistered } from "../lib/push";
import {
  createOrder,
  findOrCreateCustomer,
  monthlyPaymentSummary,
  runQuery,
  subscribeCustomers,
  subscribeOrders,
  updateOrder,
} from "../lib/queries";
import { ConfirmCard } from "../components/ConfirmCard";
import { QueryResultCard } from "../components/QueryResultCard";
import type { Customer, Order, OrderDraft, ParsedCommand, QueryResult } from "../types";

type Stage = "idle" | "listening" | "processing" | "confirming" | "saving";

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

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function Home() {
  const { supported, listening, transcript, error, start, reset } = useSpeechRecognition();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [typedText, setTypedText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [matchedOrderId, setMatchedOrderId] = useState<string | null>(null);
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

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

      if (parsed.intent === "query" && parsed.queryType) {
        const result = await runQuery(parsed.queryType);
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

  const monthSummary = useMemo(() => monthlyPaymentSummary(orders), [orders]);

  const micLabel = () => {
    if (stage === "listening") return "Listening… tap when you're done";
    if (stage === "processing") return "Got it — one sec…";
    if (!supported) return "Voice isn't supported here — type below instead";
    return "Tap and tell me about an order";
  };

  return (
    <div className="screen">
      <div className="mic-wrap">
        <button
          className={`mic-button ${stage === "listening" ? "listening" : ""} ${
            stage === "processing" ? "processing" : ""
          }`}
          onClick={handleMicPress}
          disabled={stage === "processing" || stage === "saving"}
          aria-label="Speak an order"
        >
          🎙️
        </button>
        <div className="mic-caption">{micLabel()}</div>

        {listening && transcript && <div className="transcript-box">{transcript}</div>}

        {error && <div className="error-text">{error}</div>}
        {parseError && <div className="error-text">{parseError}</div>}
        {clarification && <div className="error-text">{clarification}</div>}

        <div className="type-instead">
          <input
            placeholder="…or type it here"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTypedSubmit()}
          />
          <button onClick={handleTypedSubmit}>Go</button>
        </div>
      </div>

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
          <div style={{ fontWeight: 700, marginBottom: 10 }}>This month</div>
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
            {monthSummary.orderCount} order{monthSummary.orderCount === 1 ? "" : "s"} this month
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
                <div>
                  <div className="items">
                    {order.customerName} —{" "}
                    {order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                  </div>
                  <div className="meta">
                    {formatDate(order.deliveryDate)} ·{" "}
                    <span className={`badge ${order.status}`}>{order.status}</span>
                  </div>
                </div>
                <div className="amount">{order.amount != null ? `₹${order.amount}` : "—"}</div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
