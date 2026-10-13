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

export type OrderStatus = "pending" | "delivered";

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
  | "summary_for_period"
  | "items_by_revenue"
  | "orders_above_amount"
  | "orders_below_amount"
  | "frequent_customers"
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
  queryValue: number | null;
  periodYear: number | null;
  periodMonth: number | null; // 1-12, or null for a whole-year period
  clarification: string | null;
}

export interface Period {
  year: number;
  month: number | null; // 1-12, or null for a whole-year period
}

export interface QueryResult {
  queryType: QueryType;
  label: string;
  orders: Order[];
  revenueTotal?: number;
  customers?: { name: string; orderCount: number }[];
  items?: { name: string; quantity: number; revenue: number }[];
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

export interface RecipeIngredient {
  name: string;
  quantity: string | null; // as written, e.g. "35", "1/4" — null means "to taste" / no amount written
  unit: string | null;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  totalWeight: string | null; // e.g. "500 g" — kept separate from notes, it's the one figure she actually needs
  notes: string | null; // anything else, e.g. pan size, yield, oven temp
  photoPath: string;
  photoUrl: string;
  createdAt: string;
  updatedAt: string;
}
