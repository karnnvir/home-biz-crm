import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { subscribeOrders } from "../lib/queries";
import type { Order, OrderStatus } from "../types";

type Filter = "all" | OrderStatus;
const VALID_FILTERS: Filter[] = ["pending", "delivered", "cancelled", "all"];

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const [filter, setFilter] = useState<Filter>(
    VALID_FILTERS.includes(statusParam as Filter) ? (statusParam as Filter) : "pending"
  );

  useEffect(() => subscribeOrders(setOrders), []);

  const filtered = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );

  return (
    <div className="screen">
      <div className="app-header" style={{ padding: "8px 0 4px" }}>
        <h1>Orders</h1>
      </div>

      <div className="tabs">
        {(["pending", "delivered", "cancelled", "all"] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">No orders here.</div>
        ) : (
          filtered.map((order) => (
            <Link className="order-row" to={`/orders/${order.id}`} key={order.id}>
              <div>
                <div className="items">
                  {order.customerName} —{" "}
                  {order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                </div>
                <div className="meta">
                  {formatDate(order.deliveryDate)} ·{" "}
                  <span className={`badge ${order.status}`}>{order.status}</span>{" "}
                  <span className={`badge ${order.paid ? "paid" : "unpaid"}`}>
                    {order.paid ? "paid" : "unpaid"}
                  </span>
                </div>
              </div>
              <div className="amount">{order.amount != null ? `₹${order.amount}` : "—"}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
