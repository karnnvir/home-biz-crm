import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Query, WhereFilterOp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const TIMEZONE = "Asia/Kolkata";
const REGION = "us-central1";

interface OrderDoc {
  customerName: string;
  items: { name: string; quantity: number; unit?: string | null }[];
  amount: number | null;
  status: string;
  paid: boolean;
  deliveryDate: string;
}

// India doesn't observe DST, so a flat 24h add always lands on the right
// calendar day when re-formatted in TIMEZONE below.
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function dateInTZ(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function summarizeOrders(orders: OrderDoc[], limit = 3): string {
  const parts = orders
    .slice(0, limit)
    .map((o) => `${o.customerName} – ${o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}`);
  const extra = orders.length - limit;
  return extra > 0 ? `${parts.join("; ")}; +${extra} more` : parts.join("; ");
}

function summarizePayments(orders: OrderDoc[], limit = 3): string {
  const parts = orders.slice(0, limit).map((o) => `${o.customerName} ₹${o.amount ?? 0}`);
  const extra = orders.length - limit;
  return extra > 0 ? `${parts.join(", ")}, +${extra} more` : parts.join(", ");
}

async function sendPush(title: string, body: string, url: string): Promise<void> {
  const db = getFirestore();
  const tokensSnap = await db.collection("deviceTokens").get();
  if (tokensSnap.empty) return;
  const tokens = tokensSnap.docs.map((d) => d.id);

  // Data-only (no top-level "notification" field) so the service worker
  // builds the notification itself and can attach `url` for click routing.
  const response = await getMessaging().sendEachForMulticast({
    tokens,
    data: { title, body, url },
  });

  const staleTokens = response.responses
    .map((r, i) => (!r.success && isStaleTokenError(r.error?.code) ? tokens[i] : null))
    .filter((t): t is string => t !== null);
  await Promise.all(staleTokens.map((t) => db.collection("deviceTokens").doc(t).delete()));
}

function isStaleTokenError(code: string | undefined): boolean {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}

async function ordersWhere(
  ...clauses: [string, WhereFilterOp, unknown][]
): Promise<OrderDoc[]> {
  let q: Query = getFirestore().collection("orders");
  for (const [field, op, value] of clauses) q = q.where(field, op, value);
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as OrderDoc);
}

export const notifyToday = onSchedule(
  { schedule: "0 8 * * *", timeZone: TIMEZONE, region: REGION },
  async () => {
    const date = dateInTZ(new Date(), TIMEZONE);
    const orders = await ordersWhere(["deliveryDate", "==", date], ["status", "==", "pending"]);
    if (orders.length === 0) return;
    await sendPush(`Today's orders (${orders.length})`, summarizeOrders(orders), "/orders?status=pending");
  }
);

export const notifyTomorrow = onSchedule(
  { schedule: "2 8 * * *", timeZone: TIMEZONE, region: REGION },
  async () => {
    const date = dateInTZ(addDays(new Date(), 1), TIMEZONE);
    const orders = await ordersWhere(["deliveryDate", "==", date], ["status", "==", "pending"]);
    if (orders.length === 0) return;
    await sendPush(
      `Tomorrow's orders (${orders.length}) — confirm with customers`,
      summarizeOrders(orders),
      "/orders?status=pending"
    );
  }
);

export const notifyPaymentsPending = onSchedule(
  { schedule: "0 9 * * *", timeZone: TIMEZONE, region: REGION },
  async () => {
    const orders = await ordersWhere(["status", "==", "delivered"], ["paid", "==", false]);
    if (orders.length === 0) return;
    await sendPush(
      `Payments pending (${orders.length})`,
      summarizePayments(orders),
      "/orders?status=delivered"
    );
  }
);
