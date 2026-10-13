import type { Order } from "../types";

function formatOrderDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function OrderRowBody({ order, showChevron }: { order: Order; showChevron: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div className="items">
          {order.customerName} —{" "}
          {order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
          <div className="amount">{order.amount != null ? `₹${order.amount}` : "—"}</div>
          {showChevron && <span className="row-chevron">›</span>}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span className={`badge ${order.status}`}>{order.status}</span>
          <span className={`badge ${order.paid ? "paid" : "unpaid"}`}>
            {order.paid ? "paid" : "unpaid"}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
          {order.deliveryDate ? formatOrderDate(order.deliveryDate) : "No date"}
        </div>
      </div>
    </div>
  );
}
