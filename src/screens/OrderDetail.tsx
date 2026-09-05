import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteOrder, findOrCreateCustomer, subscribeCustomers, subscribeOrders, updateOrder } from "../lib/queries";
import { OrderFields } from "../components/OrderFields";
import type { Customer, Order, OrderDraft } from "../types";

function toDraft(order: Order): OrderDraft {
  return {
    customerName: order.customerName,
    items: order.items.map((i) => ({ ...i, unit: i.unit ?? null })),
    deliveryDate: order.deliveryDate,
    amount: order.amount,
    paid: order.paid,
    status: order.status,
  };
}

const SAVE_DEBOUNCE_MS = 700;

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const originalOrder = useRef<Order | null>(null);
  const initialized = useRef(false);
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      subscribeOrders((o) => {
        setOrders(o);
        setLoaded(true);
      }),
    []
  );
  useEffect(() => subscribeCustomers(setCustomers), []);

  const order = orders.find((o) => o.id === id);

  useEffect(() => {
    if (!initialized.current && order) {
      originalOrder.current = order;
      setDraft(toDraft(order));
      initialized.current = true;
    }
  }, [order]);

  useEffect(() => {
    if (!draft || !originalOrder.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const base = originalOrder.current!;
      setSaving(true);
      try {
        let customerId = base.customerId;
        const trimmedName = draft.customerName.trim();
        if (trimmedName && trimmedName !== base.customerName.trim()) {
          customerId = await findOrCreateCustomer(trimmedName, customers);
        }
        await updateOrder(base.id, {
          customerId,
          customerName: trimmedName || base.customerName,
          items: draft.items.filter((i) => i.name.trim()),
          deliveryDate: draft.deliveryDate,
          amount: draft.amount,
          paid: draft.paid,
          status: draft.status,
        });
      } finally {
        setSaving(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // customers is intentionally omitted: we only need it at save time, not as a re-trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const handleDelete = async () => {
    if (!order) return;
    if (!confirm("Delete this order? This can't be undone.")) return;
    await deleteOrder(order.id);
    navigate("/orders");
  };

  if (!order) {
    return (
      <div className="screen">
        <div className="empty-state">{loaded ? "Order not found." : "Loading…"}</div>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div className="screen">
      <div className="app-header" style={{ padding: "8px 0 4px" }}>
        <h1>Edit order</h1>
        <p>{saving ? "Saving…" : "Changes save automatically"}</p>
      </div>

      <div className="card">
        <OrderFields draft={draft} onChange={setDraft} />
      </div>

      <button className="big-button danger" onClick={handleDelete}>
        Delete order
      </button>
    </div>
  );
}
