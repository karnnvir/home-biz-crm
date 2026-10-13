# Changelog

## 2026-10-03 — Voice parsing no longer keeps an instance always running

`parseVoiceCommand` previously ran with `minInstances: 1` (one always-on instance) to
avoid cold starts, which costs money even when idle. Set to `minInstances: 0` as a trial
— it now costs nothing when unused, at the price of a possible cold-start delay on the
first voice command after a quiet period. If that delay is too annoying, set it back to
`minInstances: 1` in `functions/src/index.ts` and redeploy.

## 2026-10-02 — Period dropdown on the Home summary card

**What's new**
- The Home summary card's title is now a dropdown: "This month", then every previous
  month that has orders, then each full year. Picking one updates the card in place.
  Voice/typed requests ("revenue for August") still work and now also update the
  dropdown. This replaces the separate "‹ This month" reset link — pick "This month"
  from the dropdown instead.

## 2026-09-26 — Fix for blank Home screen on cold launch

Likely cause: the app's service worker wasn't configured to take over immediately when
a new version is deployed, so opening the installed app fresh could briefly render
against a stale cached bundle from before the last deploy — until something (like
navigating to another tab and back) gave the background update time to finish. Set
`skipWaiting`/`clientsClaim` so a new deploy takes effect for the next launch instead
of waiting for every open app instance to fully close first. Needs one full force-quit
after this deploys to take effect, then should self-heal on every deploy from here on.

## 2026-09-26 — Item-name grouping for the revenue report

**What's new**
- "Items by revenue" now groups spelling/wording variants of the same product into
  one row (e.g. "Ragi brownies", "rai brownies", "ragi dates brownies" → one line)
  instead of splitting revenue across every way she's said it. A new Cloud Function
  (`groupItemNames`, Claude Opus) clusters the item names seen in that period's
  report; if that call fails for any reason, the report falls back to showing
  ungrouped names rather than failing outright.
- This groups per-report, on whatever names appear in that period — it doesn't
  rewrite the underlying order data, and a name could in principle group slightly
  differently across two different reports. If this becomes annoying, the more
  thorough fix is canonicalizing item names at order-entry time (like customer
  name matching already works) — worth doing later if this per-report grouping
  isn't enough.

## 2026-09-25 — Removed "cancelled" status; fixed order-count mismatch

**What's new**
- Removed the "cancelled" order status entirely — voice, typed, and the manual Status
  dropdown now only offer Pending/Delivered. To void an order, delete it instead.
- Fixed a discrepancy where the Orders tab's count could be higher than Home's monthly
  summary for the same month: orders with no delivery date always show in the Orders
  list (so they're never lost from view), but were being silently counted as if they
  belonged to whichever month was selected. The subtitle now only counts orders that
  actually match the month, and explicitly says "(+N without a date)" when any
  date-less orders are included in the list — so the two screens' numbers agree, and
  it's clear why the list might show more rows than the count.

## 2026-09-25 — Items by revenue

**What's new**
- "Items by revenue" (or "...for August", "...for 2025", or just "items by revenue"
  for the current month by default) now works — a ranked list of items with quantity
  sold and estimated revenue.

**Known limitation**
Orders only store one total price for the whole order, not a price per item. When an
order mixes multiple items, each item's revenue is estimated by splitting the order's
total proportional to quantity — accurate for single-item orders, an approximation
whenever bundled items are priced very differently. The result is clearly labeled
"(estimated)".

## 2026-09-25 — Ask for any month or year's summary

**What's new**
- "Revenue of orders below ₹20,000" now works too (the "above" case shipped yesterday;
  "below" is the natural next ask and now shares the same logic).
- Ask for any period by voice or typing — "revenue for August", "how much did I make
  last month", "total for this year", "show me 2024" — and the Home summary card
  updates in place to show that period's total/received/pending/order-count, instead
  of popping up a separate result card. Tap "‹ This month" to jump back to the
  current month. This replaces the old fixed revenue-this-month/last-month/this-year
  query types with one general mechanism that understands any month or year.

## 2026-09-24 — Two new voice/typed queries

**What's new**
- "Revenue of orders above ₹2000" (or any amount) now works — lists matching orders
  with a revenue/order-count summary, excluding cancelled orders.
- "Customers who've placed more than 3 orders" now works — lists customers by order
  count, most frequent first.

These previously had no matching query type, so the model was guessing at the closest
existing one and returning irrelevant results.

## 2026-09-24 — Orders filters and row layout

**What's new**
- Orders tab replaces the old Pending/Delivered/Cancelled/All tabs with three filters
  — Payment (Unpaid/Paid/All), Status (Pending/Delivered/All), and Month — plus a
  count subtitle ("N orders in <month>"). Defaults to Unpaid + All statuses + the
  current month.
- Order rows in Home and Orders now show status/paid badges on their own line, with
  the delivery date (or "No date") aligned to the right — matches across both screens
  via a new shared row component.
- Notification links (today's/tomorrow's/payments-pending) still land on the right
  status filter, without the month filter hiding anything near a month boundary.

## 2026-09-23 — Visual redesign

**What's new**
- Home screen: the mic button is now a "Speak order" banner card with a dedicated
  keyboard button for typing instead, replacing the old plain circular mic button.
- Order/recipe rows in Home, Orders, and Recipes now show a chevron (›) indicating
  they're tappable.
- Edit order and edit recipe pages have a back link at the top to their list.
- Search boxes added to the Customers list ("Search customers") and Orders list
  ("Search customer or bake").
- Recipes list shows a saved-count subtitle and each row now shows an icon, ingredient
  count, and base batch weight.
- Active tab pills (Orders status filter, recipe scaling tabs) now use a blue accent
  instead of black.

## 2026-09-16 — Recipe photo capture

**What's new**
- New Recipes tab: photograph a page from a handwritten recipe notebook and Claude
  reads the ingredient list (name, quantity, unit) into an editable table, shown next
  to the original photo so you can double-check it before saving.
- Recipes stay in a searchable-by-scroll list for reference anytime, and can be edited
  (auto-saves, same as order editing) or deleted later.
- Recipe scaling: a recipe with total weight set gets Original / 1.5× / 2× tabs — flip
  between them to see every quantity recalculated by the same ratio, rounded to
  practical values (nice fractions for spoons, clean decimals for weights). Only
  Original is editable; scaled views are read-only and always reflect the current
  saved data. Pure client-side math, no extra API call.

**Setup note**
This needs Firebase Storage enabled (one-time console step, stores the recipe photos)
— see the README's setup section for details.

## 2026-09-08 — Morning reminders, monthly summary & bulk updates

**What's new**
- Push notifications: three daily reminders (delivered via Firebase Cloud Messaging) —
  today's pending orders, tomorrow's pending orders (so you can confirm with customers),
  and orders that are delivered but still unpaid. Nothing is sent on days with nothing
  to report.
- Tapping a notification now opens the right filtered view — order reminders go to the
  Pending tab, the payments-pending reminder goes to the Delivered tab.
- New "This month" summary on the Home screen: total order value, amount received,
  amount pending, and order count — all at a glance, no need to ask.
- Bulk updates in Orders: select multiple orders (or "Select all") and mark them all
  delivered or paid in one action, instead of one at a time.

**Setup note**
Push notifications need a one-time Firebase console step (generating a Web Push
certificate) — see the README's setup section for details.
