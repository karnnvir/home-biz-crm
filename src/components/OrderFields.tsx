import type { OrderDraft, OrderStatus, ParsedItem } from "../types";

interface Props {
  draft: OrderDraft;
  onChange: (draft: OrderDraft) => void;
}

function formatDateLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function OrderFields({ draft, onChange }: Props) {
  const update = (patch: Partial<OrderDraft>) => onChange({ ...draft, ...patch });

  const updateItem = (index: number, patch: Partial<ParsedItem>) => {
    const items = draft.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    update({ items });
  };

  const removeItem = (index: number) => {
    update({ items: draft.items.filter((_, i) => i !== index) });
  };

  const addItem = () => {
    update({ items: [...draft.items, { name: "", quantity: 1, unit: null }] });
  };

  return (
    <>
      <div className="field">
        <label>Customer</label>
        <input
          value={draft.customerName}
          onChange={(e) => update({ customerName: e.target.value })}
          placeholder="Customer name"
        />
      </div>

      <div className="field">
        <label>Items</label>
        {draft.items.map((item, i) => (
          <div key={i} className="item-row">
            <input
              className="item-qty"
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
            />
            <input
              className="item-name"
              value={item.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              placeholder="e.g. Chocolate cake"
            />
            <button
              type="button"
              className="icon-button danger"
              onClick={() => removeItem(i)}
              aria-label="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="big-button secondary" onClick={addItem}>
          + Add item
        </button>
      </div>

      <div className="field">
        <label>Delivery date</label>
        <input
          type="date"
          value={draft.deliveryDate}
          onChange={(e) => update({ deliveryDate: e.target.value })}
        />
        {draft.deliveryDate && (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
            {formatDateLabel(draft.deliveryDate)}
          </div>
        )}
      </div>

      <div className="field">
        <label>Price (₹) — leave blank if not decided yet</label>
        <input
          type="number"
          min={0}
          value={draft.amount ?? ""}
          onChange={(e) => update({ amount: e.target.value === "" ? null : Number(e.target.value) })}
          placeholder="Not set yet"
        />
      </div>

      <div className="field">
        <label>Status</label>
        <select
          value={draft.status}
          onChange={(e) => update({ status: e.target.value as OrderStatus })}
        >
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={draft.paid}
          onChange={(e) => update({ paid: e.target.checked })}
        />
        Already paid
      </label>
    </>
  );
}
