# MASTER X — Simulated Crypto Futures & Copy Trading Platform

A full-stack, dark-mode fintech web application featuring dual trading modes (**Master Copy Trading** and **Independent Futures Trading**), a manual deposit/withdrawal workflow, tiered referral program, KYC verification, and an admin analytics dashboard.

> All balances are internal simulated ledger numbers. No real money is involved.

## Live Demo

- Frontend: Vite dev server on port `5173`
- Backend API + WebSocket: port `3001` (proxied by the frontend under `/api`, `/uploads`, `/ws`)

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin / Master | `admin@masterx.io` | `Admin@1234` |
| User | `alice@example.com` | `Demo@1234` |
| User | `bob@example.com` | `Demo@1234` |
| User (KYC pending) | `carol@example.com` | `Demo@1234` |
| User | `derek@example.com` | `Demo@1234` |

## Tech Stack

- **Frontend:** React 18, Vite 6, Tailwind CSS v4, Lucide React, Recharts, React Router
- **Backend:** Node.js 22 (Express 4) + WebSockets (`ws`)
- **Database:** SQLite via Node's built-in `node:sqlite` (self-contained, no external DB service needed)
- **Auth:** JWT (Bearer) + bcrypt password hashing
- **Charts:** TradingView Advanced Chart widget (graceful offline fallback) + live simulated price engine (optionally seeded from Binance public API)

## Project Structure

```
.
├── package.json            # npm workspaces (server + client)
├── server/
│   ├── package.json
│   ├── data/               # SQLite database (gitignored)
│   ├── uploads/            # KYC docs & deposit proofs (gitignored)
│   └── src/
│       ├── index.js        # Express app + WS server + engine loops
│       ├── config.js       # ports, pairs, JWT secret, constants
│       ├── db.js           # schema, settings, seed-if-empty
│       ├── utils.js        # helpers (money, codes, notify)
│       ├── middleware.js   # JWT auth, admin guard, multer uploads
│       ├── ranks.js        # 5-tier referral rank definitions
│       ├── priceEngine.js  # simulated live prices (random walk + optional Binance sync)
│       ├── copyEngine.js   # signal resolution, referral commission/bonus crediting
│       ├── tradeEngine.js  # open-position liquidation checks
│       ├── ws.js           # WebSocket hub (broadcast / per-user)
│       ├── seed.js         # demo users + historical data
│       └── routes/
│           ├── auth.js     # register/login/me/profile/notifications
│           ├── kyc.js      # KYC upload + status
│           ├── wallet.js   # deposit (proof upload), withdraw, transactions
│           ├── market.js   # live prices + pairs
│           ├── trades.js   # independent futures open/close/history
│           ├── copy.js     # signals list, join-by-code, copy history
│           ├── referral.js # link, rank progress, referrals, commissions
│           └── admin.js    # analytics, user/KYC/deposit/withdrawal/signal/settings management
└── client/
    ├── package.json
    ├── vite.config.js      # /api /uploads /ws proxy → :3001
    └── src/
        ├── main.jsx / App.jsx / index.css  # Tailwind v4 theme
        ├── api.js / ws.js                  # fetch client + WebSocket hook
        ├── context/AuthContext.jsx
        ├── components/
        │   ├── Layout.jsx            # sidebar + topbar + notifications + toasts
        │   ├── Protected.jsx         # route guards
        │   ├── ui.jsx                # Card, Badge, Countdown, Modal, Button…
        │   └── TradingViewChart.jsx  # TradingView widget wrapper
        └── pages/
            ├── Login.jsx / Register.jsx
            ├── Dashboard.jsx         # balance cards, ticker, active signals, activity
            ├── Markets.jsx           # futures trading + open positions
            ├── CopyTrade.jsx         # code-drop join + active/past signals
            ├── Wallet.jsx            # deposit w/ address + proof, withdraw w/ fee/tax
            ├── Referral.jsx          # link, rank tiers, referrals, commissions
            ├── History.jsx           # independent + copy trade history tabs
            ├── KycProfile.jsx        # KYC submission + payout settings
            └── admin/                # Analytics, Users, KYC, Deposits, Withdrawals, Signals, Settings
```

## Database Schema

- **users** — id, email, password_hash, name, role (`user`/`admin`), status (`active`/`banned`), kyc_status (`none`/`pending`/`approved`/`rejected`), kyc_docs (JSON paths), kyc_message, payout_address/network, referral_code, referred_by, balance, locked, total_deposited, total_withdrawn, total_profit, created_at
- **transactions** — user_id, type (`deposit`/`withdrawal`/`trade_win`/`trade_loss`/`copy_win`/`copy_loss`/`commission`/`bonus`/`master_commission`), amount, status (`pending`/`completed`/`rejected`), proof, address, gross/fee/tax/net, meta, reviewed_by/at
- **trades** — user_id, pair, side, margin, leverage, entry_price, exit_price, pnl, status (`open`/`closed`/`liquidated`)
- **signals** — code, pair, side, duration_secs, valid_secs, return_pct, loss_pct, min/max_amount, commission_pct, status (`active`/`completed`/`cancelled`), outcome (`win`/`loss`), expires_at, completes_at, result_message
- **copy_trades** — signal_id, user_id, amount, status, pnl, commission (unique per signal+user)
- **referrals** — referrer_id, referred_id, bonus_paid
- **notifications** — user_id, title, message, read
- **settings** — key/value (deposit address, fees/tax, referral bonus, defaults…)

## Key Business Logic

- **Deposits:** user submits amount + screenshot proof → admin approves to credit balance (records to `total_deposited`); on approval the referrer automatically earns a rank-based deposit commission plus a fixed referral bonus for the first deposit.
- **Withdrawals:** platform fee + tax are auto-calculated (`net = gross − fee − tax`), gross is deducted from balance on request, refunded if rejected, marked fulfilled by admin.
- **Independent futures:** margin locked on open; PnL computed from live simulated price × leverage, capped loss at margin; auto-liquidation at −100% margin.
- **Copy trading:** admin drops a time-sensitive code (pair, duration, outcome, % return, min/max). Users join before expiry; on completion, wins credit `amount + netPnl` after the Master's commission (which flows into admin revenue analytics), losses deduct the loss % and refund the remainder.
- **Referral tiers:** 5 ranks (Beginner → Junior Trader → Senior → Elite → Master Tier) unlocked by successful referral counts (10/25/50/100), raising deposit- and profit-share percentages. Commissions are credited automatically.
- **KYC:** users upload identity images; admin approves/rejects with a custom message shown on the user's dashboard.

## Running Locally

```bash
npm install          # installs server + client workspaces
npm run seed         # creates admin + demo users + sample data
npm run dev:server   # API on :3001
npm run dev:client   # Vite on :5173 (proxies /api, /uploads, /ws)
```

Or start both together:

```bash
npm run dev
```

Production build of the frontend: `npm run build` → `client/dist`.
