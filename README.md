# STABILITY-Skymap

Pharmaceutical QA **Stability Sample Inventory Management** module.

Built with Next.js, TypeScript, Tailwind CSS, Firebase Authentication, and Cloud Firestore.

## Getting Started

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Fill Firebase web app config in `.env.local` from the Firebase Console (Project settings → Your apps).

3. Enable **Email/Password** in Firebase Authentication.

4. Deploy Firestore rules (from this repo):

```bash
npx -y firebase-tools@latest deploy --only firestore:rules
```

5. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Users:** Only an **Admin** can create accounts and assign module access (**Admin → User Management**). Public self-registration is disabled.

**Login:** Employee ID + password. The Employee ID is the login ID.

**First Admin bootstrap:** Set `NEXT_PUBLIC_INITIAL_ADMIN_EMPLOYEE_ID` in `.env.local`, create that Auth user in Firebase Console as `{EMPLOYEE_ID}@emp.stability-skymap.local` (password of your choice), then sign in once with that Employee ID. After that, create all other users from **Admin → User Management**.

## Main Modules

- Stability Dashboard
- Stability Studies
- Sample Charging & Inventory
- Upcoming Withdrawals / Withdrawal
- Movement, Reconciliation, Disposal
- Transactions, Alerts, Reports
- Masters (Study Types, Conditions, Pull Points, Chambers, Locations, Units)
