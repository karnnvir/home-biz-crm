import { useEffect, useMemo, useState } from "react";
import { deleteCustomers, renameOrMergeCustomer, subscribeCustomers, subscribeOrders } from "../lib/queries";
import type { Customer, Order } from "../types";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

type SortBy = "name" | "orders" | "amount";

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [renaming, setRenaming] = useState("");
  const [busy, setBusy] = useState(false);

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

  const emptyCustomers = useMemo(
    () => customers.filter((c) => !ordersByCustomer.has(c.id)),
    [customers, ordersByCustomer]
  );

  const handleRemoveEmpty = async () => {
    if (!confirm(`Remove ${emptyCustomers.length} customer(s) with no orders? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteCustomers(emptyCustomers.map((c) => c.id));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (customer: Customer) => {
    const name = renaming.trim();
    if (!name || name === customer.name) return;
    const exists = customers.find(
      (c) => c.id !== customer.id && c.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (
      exists &&
      !confirm(`"${exists.name}" already exists. Merge "${customer.name}" into it? All orders move over.`)
    ) {
      return;
    }
    setBusy(true);
    try {
      await renameOrMergeCustomer(customer, name, customers, ordersByCustomer.get(customer.id) ?? []);
      setExpanded(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOne = async (customer: Customer) => {
    if (!confirm(`Delete "${customer.name}"?`)) return;
    setBusy(true);
    try {
      await deleteCustomers([customer.id]);
      setExpanded(null);
    } finally {
      setBusy(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const stats = (id: string) => {
      const list = ordersByCustomer.get(id) ?? [];
      return { count: list.length, total: list.reduce((sum, o) => sum + (o.amount ?? 0), 0) };
    };
    const matches = customers.filter((c) =>
      c.name.toLowerCase().includes(search.trim().toLowerCase())
    );
    return matches.sort((a, b) => {
      if (sortBy === "orders") {
        const diff = stats(b.id).count - stats(a.id).count;
        if (diff !== 0) return diff;
      } else if (sortBy === "amount") {
        const diff = stats(b.id).total - stats(a.id).total;
        if (diff !== 0) return diff;
      }
      return a.name.localeCompare(b.name);
    });
  }, [customers, ordersByCustomer, search, sortBy]);

  return (
    <div className="screen">
      <div className="app-header" style={{ padding: "8px 0 4px" }}>
        <h1>Customers</h1>
      </div>

      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input
          placeholder="Search customers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filters-row">
        <div className="filter-box">
          <label>Sort by</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="name">Name (A–Z)</option>
            <option value="orders">Most orders</option>
            <option value="amount">Highest amount</option>
          </select>
        </div>
      </div>

      {emptyCustomers.length > 0 && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, fontSize: 14 }}>
            {emptyCustomers.length} customer{emptyCustomers.length === 1 ? " has" : "s have"} no orders.
          </div>
          <button className="big-button danger" style={{ width: "auto", padding: "10px 14px", fontSize: 14 }} onClick={handleRemoveEmpty} disabled={busy}>
            Remove
          </button>
        </div>
      )}

      <div className="card">
        {filteredCustomers.length === 0 ? (
          <div className="empty-state">{customers.length === 0 ? "No customers yet." : "No matches."}</div>
        ) : (
          filteredCustomers.map((customer) => {
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
                  onClick={() => {
                    setExpanded(isOpen ? null : customer.id);
                    setRenaming(customer.name);
                  }}
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
                    <div className="item-row">
                      <input
                        className="item-name"
                        value={renaming}
                        onChange={(e) => setRenaming(e.target.value)}
                        placeholder="Customer name"
                      />
                      <button
                        className="big-button secondary"
                        style={{ width: "auto", padding: "12px 14px", fontSize: 14 }}
                        onClick={() => handleRename(customer)}
                        disabled={busy || !renaming.trim() || renaming.trim() === customer.name}
                      >
                        Rename
                      </button>
                    </div>
                    <div className="meta" style={{ marginBottom: 8 }}>
                      Type an existing customer's name to merge this one into it.
                    </div>
                    {custOrders.length === 0 ? (
                      <div className="empty-state">
                        No orders yet.
                        <div>
                          <button
                            onClick={() => handleDeleteOne(customer)}
                            disabled={busy}
                            style={{ background: "none", border: "none", color: "var(--color-danger)", fontSize: 14, padding: 10 }}
                          >
                            Delete customer
                          </button>
                        </div>
                      </div>
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
