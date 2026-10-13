import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { bulkUpdateOrders, subscribeOrders } from "../lib/queries";
import { OrderRowBody } from "../components/OrderRow";
import type { Order } from "../types";

type PaymentFilter = "unpaid" | "paid" | "all";
type StatusFilter = "pending" | "delivered" | "all";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Date(month + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const linkedStatus: StatusFilter | null =
    statusParam === "pending" || statusParam === "delivered" ? statusParam : null;

  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(linkedStatus ? "all" : "unpaid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(linkedStatus ?? "all");
  const [month, setMonth] = useState<string>(linkedStatus ? "" : currentMonth());
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => subscribeOrders(setOrders), []);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (paymentFilter !== "all") {
      list = list.filter((o) => (paymentFilter === "paid" ? o.paid : !o.paid));
    }
    if (month) {
      list = list.filter((o) => !o.deliveryDate || o.deliveryDate.startsWith(month));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          o.items.some((it) => it.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, statusFilter, paymentFilter, month, search]);

  // filtered still includes date-less orders for every month (so they're never
  // hidden from the list) — this count is scoped to orders that actually match
  // the selected month, so the subtitle doesn't overstate what's "in" it. Any
  // gap between the two is surfaced explicitly rather than left unexplained.
  const monthMatchCount = useMemo(() => {
    if (!month) return filtered.length;
    return filtered.filter((o) => o.deliveryDate && o.deliveryDate.startsWith(month)).length;
  }, [filtered, month]);
  const datelessShown = month ? filtered.length - monthMatchCount : 0;

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelected(new Set());
  };

  const toggleOrder = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((o) => o.id))
    );
  };

  const runBulkUpdate = async (changes: Partial<Order>) => {
    setBulkBusy(true);
    try {
      await bulkUpdateOrders([...selected], changes);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="screen">
      <div
        className="app-header"
        style={{ padding: "8px 0 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <h1>Orders</h1>
          <p>
            {monthMatchCount} order{monthMatchCount === 1 ? "" : "s"}
            {month ? ` in ${monthLabel(month)}` : ""}
            {datelessShown > 0 ? ` (+${datelessShown} without a date)` : ""}
          </p>
        </div>
        <button
          onClick={toggleSelectMode}
          style={{ background: "none", border: "none", color: "var(--color-primary)", fontWeight: 600, fontSize: 15 }}
        >
          {selectMode ? "Cancel" : "Select"}
        </button>
      </div>

      <div className="filters-row">
        <div className="filter-box">
          <label>Payment</label>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="filter-box">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="filter-box" style={{ position: "relative" }}>
          <label>Month</label>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {month ? monthLabel(month) : "All"}
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Month"
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
          />
        </div>
      </div>

      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input
          placeholder="Search customer or bake"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selectMode && (
        <div className="card">
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: selected.size ? 10 : 0 }}>
            <input
              type="checkbox"
              checked={filtered.length > 0 && selected.size === filtered.length}
              onChange={toggleSelectAll}
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <div className="button-row">
              <button
                className="big-button secondary"
                disabled={bulkBusy}
                onClick={() => runBulkUpdate({ status: "delivered" })}
              >
                Mark delivered
              </button>
              <button
                className="big-button secondary"
                disabled={bulkBusy}
                onClick={() => runBulkUpdate({ paid: true })}
              >
                Mark paid
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">No orders here.</div>
        ) : (
          filtered.map((order) =>
            selectMode ? (
              <label className="order-row order-row-select" key={order.id}>
                <input
                  type="checkbox"
                  checked={selected.has(order.id)}
                  onChange={() => toggleOrder(order.id)}
                />
                <OrderRowBody order={order} showChevron={false} />
              </label>
            ) : (
              <Link className="order-row" to={`/orders/${order.id}`} key={order.id}>
                <OrderRowBody order={order} showChevron />
              </Link>
            )
          )
        )}
      </div>
    </div>
  );
}
