import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { bulkUpdateOrders, subscribeOrders } from "../lib/queries";
import type { Order, OrderStatus } from "../types";

type Filter = "all" | OrderStatus;
const VALID_FILTERS: Filter[] = ["pending", "delivered", "cancelled", "all"];

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function OrderRowBody({ order }: { order: Order }) {
  return (
    <>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="items">
          {order.customerName} —{" "}
          {order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
        </div>
        <div className="meta">
          {formatDate(order.deliveryDate)} · <span className={`badge ${order.status}`}>{order.status}</span>{" "}
          <span className={`badge ${order.paid ? "paid" : "unpaid"}`}>
            {order.paid ? "paid" : "unpaid"}
          </span>
        </div>
      </div>
      <div className="amount">{order.amount != null ? `₹${order.amount}` : "—"}</div>
    </>
  );
}

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const [filter, setFilter] = useState<Filter>(
    VALID_FILTERS.includes(statusParam as Filter) ? (statusParam as Filter) : "pending"
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => subscribeOrders(setOrders), []);

  const filtered = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );

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
        <h1>Orders</h1>
        <button
          onClick={toggleSelectMode}
          style={{ background: "none", border: "none", color: "var(--color-primary)", fontWeight: 600, fontSize: 15 }}
        >
          {selectMode ? "Cancel" : "Select"}
        </button>
      </div>

      <div className="tabs">
        {(["pending", "delivered", "cancelled", "all"] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
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
                <OrderRowBody order={order} />
              </label>
            ) : (
              <Link className="order-row" to={`/orders/${order.id}`} key={order.id}>
                <OrderRowBody order={order} />
              </Link>
            )
          )
        )}
      </div>
    </div>
  );
}
