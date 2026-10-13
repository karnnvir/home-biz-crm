# Home Biz CRM

A "just talk to it" mobile web app for home-run businesses — bakers, tailors, tutors, anyone who takes orders or bookings by word of mouth. Speak an order, confirm it, it's saved. Ask "what's pending this week" or "how much did I make this month" and get an answer.

## Try it

A design prototype is live at **[homebiz-bakerdesk.lovable.app](https://homebiz-bakerdesk.lovable.app)** — no login needed, sample data included. It's a separate, standalone preview (not connected to any real user's data), built to show the UI and flow.

A good first thing to try — tap the mic (or type) and say something like:

> "An order from Priya for chocolate cake qty 2 and brownies qty 1 for price 1200 with delivery tomorrow"

You'll get a confirm screen with the parsed customer, items, quantities, price, and delivery date before anything saves — edit anything that's off, then confirm.

## How it works

- **Voice → text**: the browser's built-in speech recognition (free, on-device).
- **Text → structured order**: a Firebase Cloud Function sends the transcript to the Claude API, which extracts the customer, items, date, and price as structured data.
- **Storage**: Firebase Firestore (customers + orders).
- **Nothing saves without confirmation** — every parsed order is shown back before it's written.

## One-time setup (things only you can do — they need your own accounts)

### 1. Create a Firebase project
1. Go to the [Firebase console](https://console.firebase.google.com/) and create a new project (free "Spark" plan is enough to start).
2. In the project, enable:
   - **Firestore Database** (production mode is fine — the rules in `firestore.rules` already lock it to signed-in users).
   - **Authentication → Sign-in method → Email/Password**.
   - **Storage** (Build → Storage → Get started, default bucket, production mode — used for recipe photos; rules in `storage.rules` lock it to signed-in users the same way).
3. In **Authentication → Users**, manually add one user: the app's primary user's email + a password. That's the only login the app needs.
4. In **Project settings → General**, scroll to "Your apps", add a **Web app**, and copy the config values.

### 2. Configure the frontend
```bash
cp .env.example .env
```
Fill in `.env` with the values from step 1.4 (`VITE_FIREBASE_API_KEY`, etc).

### 3. Point the CLI at your project
Edit `.firebaserc` and replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` with your actual Firebase project ID (shown in Project settings).

Then log in:
```bash
npx firebase login
```

### 4. Get a Claude API key and store it as a secret
Get an API key from the [Anthropic Console](https://console.anthropic.com/), then set it as a Cloud Functions secret (never put it in `.env` — it must stay server-side):
```bash
npx firebase functions:secrets:set ANTHROPIC_API_KEY
```

### 5. Deploy
```bash
npm run build
npx firebase deploy
```
This deploys Firestore rules, the Cloud Function, and the web app to Firebase Hosting. The deploy output prints the live URL.

### 6. Install it on your phone
Open the hosted URL on your phone in Chrome (Android) or Safari (iPhone), then use "Add to Home Screen" — it behaves like an installed app from there, including working while the phone is locked out of the browser chrome.

### 7. (Optional) Enable morning push notifications
1. Firebase console → **Project settings → Cloud Messaging** tab → **Web configuration → Web Push certificates** → Generate key pair.
2. Add that key to `.env` as `VITE_FIREBASE_VAPID_KEY`.
3. Edit `public/firebase-messaging-sw.js` — it can't read `.env`, so the Firebase config values near the top must be filled in by hand (same values as your `.env`).
4. Redeploy (step 5). On her phone, open the installed app and tap "Enable reminders" on the home screen — she must open it from the home-screen icon (not a Safari tab) for iOS to allow push.

She'll get three daily nudges (8:00am / 8:02am / 9:00am, `Asia/Kolkata` by default — change the `TIMEZONE` constant in `functions/src/notifications.ts` if that's wrong): today's pending orders, tomorrow's pending orders, and orders that are delivered but still unpaid. Nothing is sent on days with nothing to report.

## Local development

```bash
npm install
npm run dev
```

This runs the frontend against your **live** Firebase project (Firestore + the deployed Cloud Function), so deploy the function at least once first (step 5) before `npm run dev` will be able to parse voice commands. Firestore reads/writes work immediately since they don't need a function deploy.

> Full offline emulator testing (`firebase emulators:start`) needs a local Java runtime, which isn't installed on this machine. If you want that, install Java (e.g. `brew install openjdk`) — otherwise, testing directly against the deployed project (Firebase's free tier) works fine for this scale.

## Day-to-day use

- Tap the mic on the home screen and describe an order naturally: *"Priya wants a chocolate cake for this Saturday"*.
- Later, add the price the same way: *"Priya's cake is 1200 rupees"* — it updates the existing order instead of creating a new one.
- Update status the same way: *"Priya's order is delivered"*.
- Ask questions: *"What's pending this week?"*, *"Orders above 2000 rupees"*, *"Customers with more than 3 orders"*, *"Items by revenue"* (or *"...for August"* / *"...for 2025"*) — this last one is an **estimate**: since an order only stores one total price, an item's share in a multi-item order is split proportional to quantity, not its actual price. It also asks Claude to group item names that are clearly the same product spoken differently (mishearings, typos, singular/plural — e.g. "Ragi brownies" / "rai brownies" / "ragi dates brownies") into one row, rather than splitting revenue across every spelling variant.
- The Home screen always shows a summary card (total / received / pending / order count) for the current month — no need to ask. Tap the card's title (a dropdown) to switch to any previous month or full year that has orders, or just ask — *"revenue for August"*, *"how much did I make last month"*, *"total for this year"*, *"show me 2024"* — and the same card updates in place instead of popping up a separate result. Pick "This month" in the dropdown to jump back.
- The **Orders** and **Customers** tabs are always there as a manual fallback if voice gets something wrong — everything can be hand-edited or deleted there.
- **Bulk updates**: in Orders, tap **Select** to check off several orders at once (or "Select all" for everything in the current tab), then **Mark delivered** or **Mark paid** to update them all together — handy at the end of the day.
- **Recipes**: in the Recipes tab, tap "Add recipe" to photograph a page from a handwritten notebook — Claude reads the ingredient list (name, quantity, unit) into an editable table, shown next to the photo so you can double-check it before saving. Recipes stay in the list for reference anytime, and can be edited or deleted later.
- **Scaling a recipe**: open any recipe (needs a Total weight set) — three tabs, **Original / 1.5× / 2×**, let you flip between weight versions of the same recipe. Every quantity — grams, tbsp, tsp, even counts like "1 banana" — scales by the same ratio and rounds to a practical value (nice fractions for spoons/counts, clean decimals for weights). Only Original is editable/auto-saves; the scaled views are read-only and recompute instantly from it.

## Project structure

```
src/
  firebase.ts              Firebase init
  lib/voiceParse.ts        calls the parseVoiceCommand Cloud Function
  lib/queries.ts            Firestore reads/writes + date-range query logic
  lib/push.ts                requests notification permission, registers the FCM token
  lib/recipes.ts              Firestore + Storage CRUD for recipes
  lib/parseRecipeImage.ts     calls the parseRecipeImage Cloud Function
  lib/imageCompress.ts        resizes/re-encodes a photo before upload
  lib/recipeScale.ts           pure-math recipe scaling (no API call needed)
  hooks/useSpeechRecognition.ts
  hooks/useAuth.ts
  screens/                  Home (mic), Orders, OrderDetail, Customers, Login, Recipes, RecipeDetail
  components/                OrderFields (shared form), ConfirmCard, QueryResultCard, BottomNav, RecipeIngredientFields
public/
  firebase-messaging-sw.js  service worker that shows push notifications (edit by hand, see setup step 7)
functions/
  src/index.ts               parseVoiceCommand: calls Claude API server-side
  src/notifications.ts        3 scheduled functions: today / tomorrow / payments-pending pushes
  src/recipes.ts               parseRecipeImage: Claude vision, extracts ingredients from a photo
firestore.rules               only signed-in users can read/write
storage.rules                  only signed-in users can read/write (recipe photos)
```
