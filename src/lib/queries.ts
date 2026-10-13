import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { db } from "../firebase";
import { groupItemNames } from "./groupItemNames";
import type { Customer, Order, OrderStatus, Period, QueryResult, QueryType } from "../types";

const customersCol = collection(db, "customers");
const ordersCol = collection(db, "orders");

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function subscribeCustomers(cb: (customers: Customer[]) => void) {
  const q = query(customersCol, orderBy("name"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, "id">) })));
  });
}

export function subscribeOrders(cb: (orders: Order[]) => void) {
  const q = query(ordersCol, orderBy("deliveryDate", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) })));
  });
}

export async function findOrCreateCustomer(name: string, existing: Customer[]): Promise<string> {
  const match = existing.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (match) return match.id;
  const docRef = await addDoc(customersCol, {
    name: name.trim(),
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function createOrder(
  order: Omit<Order, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = new Date().toISOString();
  const docRef = await addDoc(ordersCol, { ...order, createdAt: now, updatedAt: now });
  return docRef.id;
}

export async function updateOrder(orderId: string, changes: Partial<Order>): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), {
    ...changes,
    updatedAt: new Date().toISOString(),
  });
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await updateOrder(orderId, { status });
}

export async function setOrderPaid(orderId: string, paid: boolean): Promise<void> {
  await updateOrder(orderId, { paid });
}

export async function deleteOrder(orderId: string): Promise<void> {
  await deleteDoc(doc(db, "orders", orderId));
}

export async function bulkUpdateOrders(orderIds: string[], changes: Partial<Order>): Promise<void> {
  await Promise.all(orderIds.map((id) => updateOrder(id, changes)));
}

function rangeForQueryType(queryType: QueryType, today = new Date()) {
  switch (queryType) {
    case "pending_today":
      return { start: iso(today), end: iso(today), label: "Pending today" };
    case "pending_tomorrow": {
      const t = addDays(today, 1);
      return { start: iso(t), end: iso(t), label: "Pending tomorrow" };
    }
    case "pending_this_week":
      return {
        start: iso(startOfWeek(today, { weekStartsOn: 1 })),
        end: iso(endOfWeek(today, { weekStartsOn: 1 })),
        label: "Pending this week",
      };
    case "pending_next_week": {
      const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
      const nextWeekEnd = addDays(endOfWeek(today, { weekStartsOn: 1 }), 7);
      return { start: iso(nextWeekStart), end: iso(nextWeekEnd), label: "Pending next week" };
    }
    default:
      return { start: iso(today), end: iso(today), label: "" };
  }
}

export interface MonthlyPaymentSummary {
  total: number;
  received: number;
  pending: number;
  orderCount: number;
}

// Shared by periodPaymentSummary and the items-by-revenue query — resolves a
// specific month/year (e.g. from a spoken "revenue for August" query), or
// defaults to the current month when no period is given.
function periodRange(period?: Period) {
  const now = new Date();
  const year = period?.year ?? now.getFullYear();
  const month = period ? period.month : now.getMonth() + 1;
  const refDate = new Date(year, (month ?? 1) - 1, 1);
  const start = iso(month ? startOfMonth(refDate) : startOfYear(refDate));
  const end = iso(month ? endOfMonth(refDate) : endOfYear(refDate));
  return { start, end, refDate, month, year };
}

function periodRangeLabel(range: ReturnType<typeof periodRange>): string {
  return range.month ? format(range.refDate, "MMMM yyyy") : String(range.year);
}

// Computed client-side from the already-subscribed orders list — cheap at
// this data scale and stays live without a separate Firestore query.
export function periodPaymentSummary(orders: Order[], period?: Period): MonthlyPaymentSummary {
  const { start, end } = periodRange(period);
  let received = 0;
  let pending = 0;
  let orderCount = 0;
  for (const o of orders) {
    if (o.deliveryDate < start || o.deliveryDate > end) continue;
    orderCount++;
    const amount = o.amount ?? 0;
    if (o.paid) received += amount;
    else pending += amount;
  }
  return { total: received + pending, received, pending, orderCount };
}

async function ordersByAmount(
  queryType: "orders_above_amount" | "orders_below_amount",
  threshold: number
): Promise<QueryResult> {
  const snap = await getDocs(ordersCol);
  const matches = (o: Order) =>
    queryType === "orders_above_amount" ? (o.amount ?? 0) >= threshold : (o.amount ?? 0) < threshold;

  const orders = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) }))
    .filter(matches)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const revenueTotal = orders.reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const label =
    queryType === "orders_above_amount"
      ? `Orders ₹${threshold.toLocaleString("en-IN")} and above`
      : `Orders below ₹${threshold.toLocaleString("en-IN")}`;
  return { queryType, label, orders, revenueTotal };
}

// Orders only store one total price for the whole order, not a price per
// item, so an item's revenue here is an ESTIMATE: each order's total is
// split across its items in proportion to quantity. Accurate for
// single-item orders; an approximation whenever items are bundled together
// at very different price points.
async function itemsByRevenue(period?: Period): Promise<QueryResult> {
  const range = periodRange(period);
  const snap = await getDocs(ordersCol);
  const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) }));

  const totals = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of orders) {
    if (o.deliveryDate < range.start || o.deliveryDate > range.end) continue;
    if (!o.amount || o.items.length === 0) continue;
    const totalQty = o.items.reduce((sum, it) => sum + it.quantity, 0);
    if (totalQty <= 0) continue;
    for (const it of o.items) {
      const key = it.name.trim().toLowerCase();
      const entry = totals.get(key) ?? { name: it.name.trim(), quantity: 0, revenue: 0 };
      entry.quantity += it.quantity;
      entry.revenue += o.amount * (it.quantity / totalQty);
      totals.set(key, entry);
    }
  }

  const rawItems = [...totals.values()];

  // Item names are free text from voice/typing, so the same real product often
  // ends up under several spellings ("Ragi brownies", "ragi dates brownies",
  // a mishearing like "rai brownies"...). Ask Claude to cluster same-product
  // variants together rather than showing each raw spelling as its own row.
  // If this call fails for any reason, fall back to the ungrouped totals
  // rather than losing the report entirely.
  let items = rawItems;
  try {
    const groups = await groupItemNames(rawItems.map((i) => i.name));
    if (groups.length > 0) {
      const byName = new Map(rawItems.map((i) => [i.name, i]));
      items = groups.map((g) => {
        const quantity = g.members.reduce((sum, m) => sum + (byName.get(m)?.quantity ?? 0), 0);
        const revenue = g.members.reduce((sum, m) => sum + (byName.get(m)?.revenue ?? 0), 0);
        return { name: g.canonicalName, quantity, revenue };
      });
    }
  } catch (err) {
    console.error("groupItemNames failed, showing ungrouped items", err);
  }

  items.sort((a, b) => b.revenue - a.revenue);
  const revenueTotal = items.reduce((sum, i) => sum + i.revenue, 0);

  return {
    queryType: "items_by_revenue",
    label: `Items by revenue (estimated) — ${periodRangeLabel(range)}`,
    orders: [],
    items,
    revenueTotal,
  };
}

export async function runQuery(
  queryType: QueryType,
  queryValue: number | null = null,
  period?: Period
): Promise<QueryResult> {
  if (queryType === "orders_above_amount" || queryType === "orders_below_amount") {
    return ordersByAmount(queryType, queryValue ?? 0);
  }

  if (queryType === "items_by_revenue") {
    return itemsByRevenue(period);
  }

  if (queryType === "frequent_customers") {
    const threshold = queryValue ?? 0;
    const snap = await getDocs(ordersCol);
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) }));
    const counts = new Map<string, { name: string; count: number }>();
    for (const o of all) {
      const entry = counts.get(o.customerId) ?? { name: o.customerName, count: 0 };
      entry.count += 1;
      counts.set(o.customerId, entry);
    }
    const customers = [...counts.values()]
      .filter((c) => c.count > threshold)
      .sort((a, b) => b.count - a.count)
      .map((c) => ({ name: c.name, orderCount: c.count }));
    return {
      queryType,
      label: `Customers with more than ${threshold} orders`,
      orders: [],
      customers,
    };
  }

  const { start, end, label } = rangeForQueryType(queryType);
  const isPendingQuery = queryType.startsWith("pending_");
  const dateField = "deliveryDate";

  const constraints = [where(dateField, ">=", start), where(dateField, "<=", end)];
  if (isPendingQuery) constraints.push(where("status", "==", "pending"));

  const q = query(ordersCol, ...constraints);
  const snap = await getDocs(q);
  const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) }));

  return { queryType, label, orders };
}
