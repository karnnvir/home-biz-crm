import { OrderFields } from "./OrderFields";
import type { Order, OrderDraft } from "../types";

interface Props {
  draft: OrderDraft;
  onChange: (draft: OrderDraft) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isUpdate: boolean;
  existing?: Order;
  saving: boolean;
}

export function ConfirmCard({ draft, onChange, onConfirm, onCancel, isUpdate, existing, saving }: Props) {
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>
        {isUpdate ? "Update this order?" : "Add this order?"}
      </div>

      {isUpdate && existing && <UpdateBanner existing={existing} draft={draft} />}

      <OrderFields draft={draft} onChange={onChange} />

      <div className="button-row">
        <button className="big-button secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button className="big-button primary" onClick={onConfirm} disabled={saving}>
          {saving ? "Saving…" : isUpdate ? "Update order" : "Save order"}
        </button>
      </div>
    </div>
  );
}

const money = (n: number | null) => (n == null ? "no price" : `₹${n.toLocaleString("en-IN")}`);
const when = (iso: string) => iso || "no date";
const itemsText = (items: { name: string; quantity: number }[]) =>
  items.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "no items";

// Updating overwrites the saved order, so show exactly what's being replaced.
function UpdateBanner({ existing, draft }: { existing: Order; draft: OrderDraft }) {
  const rows: [string, string, string][] = [
    ["Items", itemsText(existing.items), itemsText(draft.items.filter((i) => i.name.trim()))],
    ["Date", when(existing.deliveryDate), when(draft.deliveryDate)],
    ["Price", money(existing.amount), money(draft.amount)],
  ];
  return (
    <div
      style={{
        background: "var(--color-warning-bg)",
        border: "1.5px solid var(--color-warning)",
        borderRadius: 12,
        padding: "10px 12px",
        marginBottom: 14,
        fontSize: 14,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        This will replace {existing.customerName}'s existing order
      </div>
      {rows.map(([label, was, now]) => (
        <div key={label} style={{ marginBottom: 2 }}>
          <span style={{ color: "var(--color-text-muted)" }}>{label}: </span>
          {was === now ? (
            was
          ) : (
            <>
              <s>{was}</s> → <strong>{now}</strong>
            </>
          )}
        </div>
      ))}
      <div style={{ marginTop: 6, color: "var(--color-text-muted)" }}>
        Meant to add a new order? Cancel and say it again with "new order".
      </div>
    </div>
  );
}
