# Changelog

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
