import { useEffect, useMemo, useState } from "react";
import { subscribeCustomers, subscribeOrders } from "../lib/queries";
import type { Customer, Order } from "../types";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => subscribeCustomers(setCustomers), []);
  useEffect(() => subscribeOrders(setOrders), []);

  const ordersByCustomer = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      const list = map.get(o.customerId) ?? [];
      list.push(o);
      map.set(o.customerId, list);
    }
    return map;
  }, [orders]);

  return (
    <div className="screen">
      <div className="app-header" style={{ padding: "8px 0 4px" }}>
        <h1>Customers</h1>
      </div>

      <div className="card">
        {customers.length === 0 ? (
          <div className="empty-state">No customers yet.</div>
        ) : (
          customers.map((customer) => {
            const custOrders = ordersByCustomer.get(customer.id) ?? [];
            const totalRevenue = custOrders.reduce((sum, o) => sum + (o.amount ?? 0), 0);
            const isOpen = expanded === customer.id;
            return (
              <div key={customer.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <button
                  className="order-row"
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    borderBottom: "none",
                  }}
                  onClick={() => setExpanded(isOpen ? null : customer.id)}
                >
                  <div>
                    <div className="items">{customer.name}</div>
                    <div className="meta">
                      {custOrders.length} order{custOrders.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="amount">₹{totalRevenue.toLocaleString("en-IN")}</div>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 0 12px" }}>
                    {custOrders.length === 0 ? (
                      <div className="empty-state">No orders yet.</div>
                    ) : (
                      custOrders
                        .sort((a, b) => (a.deliveryDate < b.deliveryDate ? 1 : -1))
                        .map((order) => (
                          <div className="order-row" key={order.id}>
                            <div>
                              <div className="items">
                                {order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                              </div>
                              <div className="meta">
                                {formatDate(order.deliveryDate)} ·{" "}
                                <span className={`badge ${order.status}`}>{order.status}</span>
                              </div>
                            </div>
                            <div className="amount">
                              {order.amount != null ? `₹${order.amount}` : "—"}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
