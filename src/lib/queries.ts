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
  subMonths,
} from "date-fns";
import { db } from "../firebase";
import type { Customer, Order, OrderStatus, QueryResult, QueryType } from "../types";

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
    case "revenue_this_month":
    case "orders_this_month":
      return {
        start: iso(startOfMonth(today)),
        end: iso(endOfMonth(today)),
        label: queryType === "revenue_this_month" ? "Revenue this month" : "Orders this month",
      };
    case "revenue_last_month": {
      const lastMonth = subMonths(today, 1);
      return {
        start: iso(startOfMonth(lastMonth)),
        end: iso(endOfMonth(lastMonth)),
        label: "Revenue last month",
      };
    }
    case "revenue_this_year":
    case "orders_this_year":
      return {
        start: iso(startOfYear(today)),
        end: iso(endOfYear(today)),
        label: queryType === "revenue_this_year" ? "Revenue this year" : "Orders this year",
      };
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

// Computed client-side from the already-subscribed orders list — cheap at
// this data scale and stays live without a separate Firestore query.
export function monthlyPaymentSummary(orders: Order[], today = new Date()): MonthlyPaymentSummary {
  const start = iso(startOfMonth(today));
  const end = iso(endOfMonth(today));
  let received = 0;
  let pending = 0;
  let orderCount = 0;
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    if (o.deliveryDate < start || o.deliveryDate > end) continue;
    orderCount++;
    const amount = o.amount ?? 0;
    if (o.paid) received += amount;
    else pending += amount;
  }
  return { total: received + pending, received, pending, orderCount };
}

export async function runQuery(queryType: QueryType): Promise<QueryResult> {
  const { start, end, label } = rangeForQueryType(queryType);
  const isPendingQuery = queryType.startsWith("pending_");
  const dateField = "deliveryDate";

  const constraints = [where(dateField, ">=", start), where(dateField, "<=", end)];
  if (isPendingQuery) constraints.push(where("status", "==", "pending"));

  const q = query(ordersCol, ...constraints);
  const snap = await getDocs(q);
  const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) }));

  const isRevenueQuery = queryType.startsWith("revenue_");
  const revenueTotal = isRevenueQuery
    ? orders.reduce((sum, o) => sum + (o.amount ?? 0), 0)
    : undefined;

  return { queryType, label, orders, revenueTotal };
}
