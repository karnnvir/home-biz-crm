import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import * as chrono from "chrono-node";

initializeApp();

export { notifyToday, notifyTomorrow, notifyPaymentsPending } from "./notifications.js";
export { parseRecipeImage } from "./recipes.js";
export { groupItemNames } from "./items.js";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";

type Intent = "new_order" | "update_order" | "query" | "unknown";
type QueryType =
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

interface RequestBody {
  transcript: string;
  today: string; // ISO date
  customers: { id: string; name: string }[];
  openOrders: {
    id: string;
    customerId: string;
    customerName: string;
    items: { name: string; quantity: number; unit?: string | null }[];
    deliveryDate: string;
    amount: number | null;
    status: string;
  }[];
}

type Status = "pending" | "delivered";

interface ExtractedOrder {
  intent: Intent;
  customerName: string | null;
  matchedCustomerId: string | null;
  items: { name: string; quantity: number; unit: string | null }[];
  datePhrase: string | null;
  amount: number | null;
  paid: boolean | null;
  status: Status | null;
  matchedOrderId: string | null;
  queryType: QueryType | null;
  queryValue: number | null;
  periodPhrase: string | null;
  periodGranularity: "month" | "year" | null;
  clarification: string | null;
}

const TOOL_SCHEMA = {
  name: "extract_order",
  description:
    "Extract a structured order, order update, or question from a home business owner's spoken note.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["new_order", "update_order", "query", "unknown"],
        description:
          "new_order: a brand new order was described. update_order: this refers to an existing order (e.g. adding/changing a price, date, or status). query: she's asking a question about pending orders or revenue. unknown: unclear or unrelated speech.",
      },
      customerName: { type: ["string", "null"], description: "Customer name as spoken." },
      matchedCustomerId: {
        type: ["string", "null"],
        description: "id from the provided customers list if this customer already exists (match by name, allowing for minor mishearings/nicknames), else null.",
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: ["string", "null"] },
          },
          required: ["name", "quantity"],
        },
      },
      datePhrase: {
        type: ["string", "null"],
        description: "The raw delivery date phrase as spoken (e.g. 'this Saturday', 'next Tuesday', 'tomorrow', '15th September'), if any. Do not resolve it yourself.",
      },
      amount: { type: ["number", "null"], description: "Price mentioned, if any." },
      paid: { type: ["boolean", "null"], description: "Whether she said this was already paid." },
      status: {
        type: ["string", "null"],
        enum: ["pending", "delivered", null],
        description:
          "Set only if she explicitly says the order's status changed, e.g. 'that order is delivered', 'I delivered Priya's cake'. Leave null otherwise — do not infer this from a price or date being mentioned. There is no 'cancelled' status — if she wants an order gone, treat it as a request to delete it, not a status change (there's no delete intent to extract; just leave status null and let her use the app's delete option).",
      },
      matchedOrderId: {
        type: ["string", "null"],
        description: "For update_order: the id from openOrders this update refers to, if it can be confidently matched by customer name and items.",
      },
      queryType: {
        type: ["string", "null"],
        enum: [
          "pending_today",
          "pending_tomorrow",
          "pending_this_week",
          "pending_next_week",
          "summary_for_period",
          "items_by_revenue",
          "orders_above_amount",
          "orders_below_amount",
          "frequent_customers",
          "unknown",
          null,
        ],
        description:
          "Set only when intent is 'query'. summary_for_period: she's asking about revenue/earnings/orders for a specific month or year, e.g. 'revenue for August', 'how much did I make last month', 'total for this year', 'show me 2024' — covers questions about the current month/year too. items_by_revenue: she wants a list of items/products sold, ranked by revenue, e.g. 'revenue by item', 'which items sell the most', 'list of items sorted by revenue' — optionally for a specific month/year via periodPhrase, same as summary_for_period; if she doesn't mention a period, leave periodPhrase null and it defaults to the current month. orders_above_amount: she wants orders (and their total revenue) at or above a price threshold, e.g. 'orders above 2000 rupees'. orders_below_amount: same but below/under a threshold, e.g. 'orders below 20000 rupees'. frequent_customers: she wants customers who have placed more than N orders, e.g. 'customers with more than 3 orders'.",
      },
      queryValue: {
        type: ["number", "null"],
        description: "The numeric threshold for orders_above_amount/orders_below_amount (a rupee amount) or frequent_customers (an order count). Null for every other queryType.",
      },
      periodPhrase: {
        type: ["string", "null"],
        description: "Only for queryType 'summary_for_period' or 'items_by_revenue': the raw month/year phrase as spoken (e.g. 'August', 'last month', 'this year', '2024', 'August 2025'), if any. Do not resolve it yourself.",
      },
      periodGranularity: {
        type: ["string", "null"],
        enum: ["month", "year", null],
        description: "Only alongside periodPhrase: whether she's asking about a single month or a whole year.",
      },
      clarification: {
        type: ["string", "null"],
        description: "A short, friendly message to show her if intent is 'unknown' or the request is too ambiguous to act on.",
      },
    },
    required: ["intent", "customerName", "matchedCustomerId", "items", "datePhrase", "amount", "paid", "status", "matchedOrderId", "queryType", "queryValue", "periodPhrase", "periodGranularity", "clarification"],
  },
};

function buildSystemPrompt(body: RequestBody): string {
  const weekday = new Date(body.today + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });
  return [
    `Today is ${weekday}, ${body.today}. You help a home-business owner log customer orders by voice.`,
    `Known customers: ${JSON.stringify(body.customers)}`,
    `Open (pending) orders: ${JSON.stringify(body.openOrders)}`,
    `When she mentions a price, date, or status change for someone who already has a pending order for a similar item, treat it as update_order and pick the best matching id from openOrders. Otherwise treat it as new_order.`,
    `Status changes ("delivered", "done", "picked up") are always update_order against an existing order — never invent a new order just to record a status change. There is no "cancelled" status.`,
    `Always call the extract_order tool with your best interpretation.`,
  ].join("\n\n");
}

function resolveDatePhrase(phrase: string | null, referenceISO: string): string | null {
  if (!phrase) return null;
  const referenceDate = new Date(referenceISO + "T12:00:00");
  const parsed = chrono.parseDate(phrase, referenceDate, { forwardDate: true });
  if (!parsed) return null;
  return parsed.toISOString().slice(0, 10);
}

// Revenue/earnings questions are always about a period that's already happened
// (or is in progress), so resolve with forwardDate: false — unlike order due
// dates, which always look forward.
function resolvePeriod(
  phrase: string | null,
  granularity: "month" | "year" | null,
  referenceISO: string
): { year: number; month: number | null } | null {
  if (!phrase || !granularity) return null;

  const bareYear = phrase.trim().match(/^(\d{4})$/);
  if (bareYear) return { year: Number(bareYear[1]), month: null };

  const referenceDate = new Date(referenceISO + "T12:00:00");
  const parsed = chrono.parseDate(phrase, referenceDate, { forwardDate: false });
  if (!parsed) return null;

  return granularity === "year"
    ? { year: parsed.getFullYear(), month: null }
    : { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
}

export const parseVoiceCommand = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "us-central1", cors: true, minInstances: 0 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in first.");
    }

    const body = request.data as RequestBody;
    if (!body?.transcript?.trim()) {
      throw new HttpsError("invalid-argument", "Missing transcript.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY.value(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: buildSystemPrompt(body),
        messages: [{ role: "user", content: body.transcript }],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "extract_order" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Anthropic API error", response.status, text);
      throw new HttpsError("internal", "Couldn't understand that right now. Try again.");
    }

    const data = (await response.json()) as {
      content: { type: string; input?: unknown }[];
    };
    const toolUse = data.content.find((c) => c.type === "tool_use");
    if (!toolUse?.input) {
      throw new HttpsError("internal", "Couldn't understand that. Try again or type it instead.");
    }

    const extracted = toolUse.input as ExtractedOrder;
    const deliveryDate = resolveDatePhrase(extracted.datePhrase, body.today);
    const period = resolvePeriod(extracted.periodPhrase, extracted.periodGranularity, body.today);

    return {
      intent: extracted.intent,
      customerName: extracted.customerName,
      matchedCustomerId: extracted.matchedCustomerId,
      items: extracted.items ?? [],
      deliveryDate,
      amount: extracted.amount,
      paid: extracted.paid,
      status: extracted.status,
      matchedOrderId: extracted.matchedOrderId,
      queryType: extracted.queryType,
      queryValue: extracted.queryValue,
      periodYear: period?.year ?? null,
      periodMonth: period?.month ?? null,
      clarification: extracted.clarification,
    };
  }
);
