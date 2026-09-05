import { OrderFields } from "./OrderFields";
import type { OrderDraft } from "../types";

interface Props {
  draft: OrderDraft;
  onChange: (draft: OrderDraft) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isUpdate: boolean;
  saving: boolean;
}

export function ConfirmCard({ draft, onChange, onConfirm, onCancel, isUpdate, saving }: Props) {
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>
        {isUpdate ? "Update this order?" : "Add this order?"}
      </div>

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
