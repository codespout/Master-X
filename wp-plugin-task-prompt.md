# Task: Build the MASTER X WordPress Plugin (repo: masterx-wp)

You are building a production-ready, sellable WordPress plugin version of
**MASTER X — Simulated Crypto Futures & Copy Trading Platform** for the
ThemeForest/Envato marketplace. It must run on standard WordPress hosting
(PHP + MySQL) with **no Node.js** dependency, meet Envato review requirements,
and read like professionally written human code.

## Context

A working reference app exists (Node.js: Express + React + SQLite + WebSockets).
Use its **business logic** as the behavior spec — but DO NOT port or reuse its
Node server code. Reimplement all backend logic in PHP as a WordPress plugin.
The React frontend MAY be reused (compile it and ship the un-minified source
too), retargeted from WebSockets/Express to WordPress REST + AJAX polling.

## Agreed decisions (locked — do not revisit)

- Name: "MASTER X — Simulated Crypto Trading"; slug/folder `masterx-trading`;
  text domain `masterx-trading`; function prefix `mxt_`; class prefix `MXT_`;
  DB tables `{wp}mxt_*`; REST namespace `mxt/v1`. Requires WP 5.8+, PHP 7.4+
  (8.x compatible), GPLv2+ license, no external PHP dependencies.
- **Auth:** dedicated plugin user table (NOT wp_users) + custom cookie sessions
  (hashed tokens in a sessions table, HttpOnly cookie) + nonces. Login/register
  are shortcode forms (`[masterx_login]`, `[masterx_register]`) posting to
  `admin-post.php`. Admin is a plugin-managed account (email/password/login-URL
  slug configured in Settings). Passwords via `wp_hash_password`/`wp_check_password`.
  REST auth = cookie + `X-WP-Nonce`; admin REST gated by plugin admin role.
- **Config:** everything through the WP Settings API as one `mxt_settings`
  option, tabbed pages: **Dashboard**, **Admin Settings** (admin login URL slug,
  admin email, change password, demo mode + load demo data), **User Settings**
  (login page slug, register page slug, post-login redirect, registration
  open/close, default starting balance, withdrawal grace days), **Trading
  Settings** (pairs default BTC/ETH/SOL/BNB/XRP/DOGE-USDT, leverage range,
  deposit address+networks, deposit fee/tax, withdrawal fee/tax, signal
  min/max, copy commission %, 5 referral tiers + bonuses), **Cron Settings**
  (intervals for price/signal/trade/cleanup, Binance sync toggle, run-now per
  job, last-run timestamps).
- **Scheduling:** WP-Cron jobs — price engine (random walk + optional Binance
  public API sync, ~60s), signal resolution (~30s), futures liquidation (~60s),
  cleanup (daily). Document real-cron setup (`define('DISABLE_WP_CRON', true)`
  + system crontab) for accurate signal timing.
- **Frontend:** reuse the React app. `api.js` base → `rest_url('mxt/v1')` with
  `X-WP-Nonce`; `ws.js` → polling hook (prices ~2s, balances/notifications
  ~15–30s). Keep all animations/the dark theme. TradingView widget embed stays.
  Vite build output → `public/app/`; enqueue only on plugin pages (slug match,
  versioned URLs). Ship the React source under `src/` for auditability.
- **ThemeForest review-ready:** sanitize every input, escape every output
  (`esc_html`, `esc_attr`, `esc_url`, `wp_kses`), all SQL through
  `$wpdb->prepare`, nonces on all forms + REST writes, capability/role checks,
  upload validation (type/size via `wp_handle_upload`), full i18n (`__`, `_e`,
  `esc_html__`, text domain loaded, `languages/masterx-trading.pot`), unique
  prefixes, no short tags / no `eval` / no remote code. Deliver `readme.txt`
  (WP format), `changelog.txt`, `LICENSE.txt` (GPLv2 + bundled MIT asset
  attributions), screenshots in `assets/`.

## Feature parity (port these behaviors exactly)

- **Deposit:** user submits amount + screenshot proof → pending → admin
  approve credits balance + records total_deposited; referrer earns rank-based
  deposit commission + fixed first-deposit bonus.
- **Withdrawal:** gross deducted on request; net = gross − fee − tax; reject
  refunds gross; admin fulfills.
- **Independent futures:** margin locked on open; PnL = live price × leverage;
  loss capped at margin; auto-liquidation at −100% via cron.
- **Copy trading:** admin drops time-limited code (pair, side, duration,
  return %, loss %, min/max amount); users join before expiry; on completion
  wins credit amount + netPnl minus master commission (flows to admin revenue
  analytics); losses deduct loss % and refund remainder.
- **Referral tiers:** 5 ranks by successful referral counts (10/25/50/100),
  each raising deposit- and profit-share percentages; automatic crediting.
- **KYC:** identity image upload, admin approve/reject with custom message
  surfaced on the user dashboard.
- **Grace hold:** new users subject to withdrawal grace (configurable days);
  day-0 exemption and admin override/clear preserved.
- **Notifications** per user; **admin panel** with analytics, users, KYC,
  deposits, withdrawals, signals, settings as native WP list tables + AJAX
  row actions.

## Database (custom tables via $wpdb)

`mxt_users` (email, password_hash, name, role user/admin, status active/banned,
kyc_status none/pending/approved/rejected, kyc_docs JSON, kyc_message,
payout_address/network, referral_code, referred_by, balance DECIMAL(18,8),
locked, total_deposited, total_withdrawn, total_profit, grace_ends_at,
created_at), `mxt_sessions`, `mxt_transactions` (type deposit/withdrawal/
trade_win/trade_loss/copy_win/copy_loss/commission/bonus/master_commission,
status pending/completed/rejected, proof, gross/fee/tax/net, meta JSON,
reviewed_by/at), `mxt_trades`, `mxt_signals` (code, pair, side, duration_secs,
valid_secs, return_pct, loss_pct, min/max_amount, commission_pct, status,
outcome, expires_at, completes_at, result_message), `mxt_copy_trades` (unique
signal_id+user_id), `mxt_referrals`, `mxt_notifications`.

Pure logic (price walk, PnL, commissions, rank thresholds, grace checks) must
live in standalone classes with NO `$wpdb`, so they can be unit-tested without
a WP runtime.

## Code style (critical)

Write idiomatic, professional WordPress code that reads as if a senior human
developer wrote it: real purposeful docblocks, natural (not perfectly uniform)
formatting, no explanatory filler comments, no AI-telltale boilerplate, no
"generated by" markers. Class-per-file with `class-mxt-*.php` naming. Never
add comments that merely restate the code.

## Build phasing

1. Core skeleton: `masterx.php` header/bootstrap, `class-mxt-install.php`
   (tables, defaults, cron scheduling), option registry, menu shell,
   shortcodes, asset enqueue.
2. Custom auth: sessions, login/register forms, REST auth wiring.
3. Wallet: deposits/withdrawals/transactions + admin review screens.
4. Market + futures engine + price cron.
5. Copy engine + signal cron.
6. Referrals + KYC.
7. Admin dashboard/analytics + reports.
8. React frontend retarget (api.js/ws.js) + Vite build into `public/app/`.
9. Review-readiness pass: i18n, escaping audit, readme/changelog/license/
   screenshots, `php -l`, unit tests for pure logic.

Each phase must end with a verifiable milestone before moving on.

## Verification (required before claiming done)

- `php -l` on every PHP file (install PHP in the sandbox for dev if needed).
- Unit tests (plain PHP, no WP runtime) for price/trade/copy engines,
  referral tiers, grace logic.
- Try to stand up WordPress locally for smoke tests (PHP + MySQL, or the WP
  SQLite drop-in, memory permitting); otherwise write a GitHub Actions WP
  integration-test workflow + a manual QA checklist.
- Manual acceptance mapped from the Node app: register/login, deposit →
  approve, withdraw → reject/fulfill, futures open/close/liquidate, copy
  join/resolve win+loss, referral commission, KYC approve/reject, admin
  actions, settings save/round-trip.

## Constraints

- Sandbox has limited RAM (~231MB), no Java/Android SDK. Install PHP/MySQL
  only for development/testing, foreground, unattended (`-y`).
- This is the `masterx-wp` repo: keep ALL WordPress code under the plugin
  folder. Do not copy the Node app's server code, `node_modules`, or its DB.
- Follow the workflow: read the design spec in this repo at
  `docs/superpowers/specs/2026-08-22-masterx-wordpress-plugin-design.md`
  (copy it here if missing), then brainstorm → design → plan → implement if you
  must deviate. Otherwise execute the phasing above.
