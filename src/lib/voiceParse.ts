import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { Customer, Order, ParsedCommand } from "../types";

interface ParseVoiceCommandRequest {
  transcript: string;
  today: string; // ISO date
  customers: Pick<Customer, "id" | "name">[];
  openOrders: Pick<
    Order,
    "id" | "customerId" | "customerName" | "items" | "deliveryDate" | "amount" | "status"
  >[];
}

const parseVoiceCommandFn = httpsCallable<ParseVoiceCommandRequest, ParsedCommand>(
  functions,
  "parseVoiceCommand"
);

// Keep the request payload small (faster to send and faster for the model to read)
// even as her customer/order history grows over months and years.
const MAX_CUSTOMERS = 60;
const MAX_OPEN_ORDERS = 50;

export async function parseVoiceCommand(
  transcript: string,
  customers: Customer[],
  openOrders: Order[]
): Promise<ParsedCommand> {
  const today = new Date().toISOString().slice(0, 10);

  const recentCustomers = [...customers]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MAX_CUSTOMERS);

  const recentOpenOrders = openOrders
    .filter((o) => o.status === "pending")
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, MAX_OPEN_ORDERS);

  const result = await parseVoiceCommandFn({
    transcript,
    today,
    customers: recentCustomers.map((c) => ({ id: c.id, name: c.name })),
    openOrders: recentOpenOrders.map((o) => ({
      id: o.id,
      customerId: o.customerId,
      customerName: o.customerName,
      items: o.items,
      deliveryDate: o.deliveryDate,
      amount: o.amount,
      status: o.status,
    })),
  });
  return result.data;
}
