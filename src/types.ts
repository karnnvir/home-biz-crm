export interface Customer {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  unit?: string | null;
}

export type OrderStatus = "pending" | "delivered" | "cancelled";

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  deliveryDate: string; // ISO date, e.g. 2026-09-13
  amount: number | null;
  paid: boolean;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type QueryType =
  | "pending_today"
  | "pending_tomorrow"
  | "pending_this_week"
  | "pending_next_week"
  | "revenue_this_month"
  | "revenue_last_month"
  | "revenue_this_year"
  | "orders_this_month"
  | "orders_this_year"
  | "unknown";

export type ParsedIntent = "new_order" | "update_order" | "query" | "unknown";

export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string | null;
}

export interface ParsedCommand {
  intent: ParsedIntent;
  customerName: string | null;
  matchedCustomerId: string | null;
  items: ParsedItem[];
  deliveryDate: string | null; // resolved ISO date, computed server-side
  amount: number | null;
  paid: boolean | null;
  status: OrderStatus | null;
  matchedOrderId: string | null;
  queryType: QueryType | null;
  clarification: string | null;
}

export interface QueryResult {
  queryType: QueryType;
  label: string;
  orders: Order[];
  revenueTotal?: number;
}

// Shared editable shape used by both the voice-confirm screen and the
// manual order-edit screen, so the two present identical fields.
export interface OrderDraft {
  customerName: string;
  items: ParsedItem[];
  deliveryDate: string; // ISO date, "" if unknown
  amount: number | null;
  paid: boolean;
  status: OrderStatus;
}
