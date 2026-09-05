import type { QueryResult } from "../types";

interface Props {
  result: QueryResult;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function QueryResultCard({ result, onClose }: Props) {
  const isRevenue = result.queryType.startsWith("revenue_");

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{result.label}</div>

      {isRevenue && (
        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className="stat-tile">
            <div className="value">₹{(result.revenueTotal ?? 0).toLocaleString("en-IN")}</div>
            <div className="label">Revenue</div>
          </div>
          <div className="stat-tile">
            <div className="value">{result.orders.length}</div>
            <div className="label">Orders</div>
          </div>
        </div>
      )}

      {result.orders.length === 0 ? (
        <div className="empty-state">Nothing here.</div>
      ) : (
        result.orders.map((order) => (
          <div className="order-row" key={order.id}>
            <div>
              <div className="items">
                {order.customerName} —{" "}
                {order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
              </div>
              <div className="meta">
                {formatDate(order.deliveryDate)} · <span className={`badge ${order.status}`}>{order.status}</span>
              </div>
            </div>
            <div className="amount">{order.amount != null ? `₹${order.amount}` : "—"}</div>
          </div>
        ))
      )}

      <button className="big-button secondary" style={{ marginTop: 14 }} onClick={onClose}>
        Done
      </button>
    </div>
  );
}
