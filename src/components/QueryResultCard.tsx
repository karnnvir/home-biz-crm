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
  const isItemsList = result.queryType === "items_by_revenue";
  const isRevenue =
    result.queryType === "orders_above_amount" || result.queryType === "orders_below_amount" || isItemsList;
  const isCustomerList = result.queryType === "frequent_customers";

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{result.label}</div>

      {isRevenue && (
        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className="stat-tile">
            <div className="value">₹{Math.round(result.revenueTotal ?? 0).toLocaleString("en-IN")}</div>
            <div className="label">Revenue</div>
          </div>
          <div className="stat-tile">
            <div className="value">{isItemsList ? (result.items?.length ?? 0) : result.orders.length}</div>
            <div className="label">{isItemsList ? "Items" : "Orders"}</div>
          </div>
        </div>
      )}

      {isItemsList ? (
        (result.items?.length ?? 0) === 0 ? (
          <div className="empty-state">Nothing here.</div>
        ) : (
          result.items!.map((item) => (
            <div className="order-row" key={item.name}>
              <div>
                <div className="items">{item.name}</div>
                <div className="meta">{item.quantity} sold</div>
              </div>
              <div className="amount">₹{Math.round(item.revenue).toLocaleString("en-IN")}</div>
            </div>
          ))
        )
      ) : isCustomerList ? (
        (result.customers?.length ?? 0) === 0 ? (
          <div className="empty-state">Nothing here.</div>
        ) : (
          result.customers!.map((c) => (
            <div className="order-row" key={c.name}>
              <div className="items">{c.name}</div>
              <div className="amount">
                {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
              </div>
            </div>
          ))
        )
      ) : result.orders.length === 0 ? (
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
