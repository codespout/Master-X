# MASTER X WordPress Plugin — Design

**Date:** 2026-08-22
**Status:** Approved (design), pending user review of this spec
**Product:** MASTER X — Simulated Crypto Trading (WordPress plugin for ThemeForest)

## 1. Goal

Port the existing Node.js MASTER X platform (simulated crypto futures + copy trading)
into a self-contained WordPress plugin that:

- Runs on any standard WordPress hosting (PHP, MySQL) with **no Node.js**.
- Keeps the current React frontend look, feel, and animations.
- Exposes all configuration in the WP admin (Admin settings, User settings,
  Trading settings, Cron settings).
- Meets ThemeForest / Envato review requirements and is ready to sell.
- Reads as professionally written, human-authored code (idiomatic WP style,
  no filler comments, no framework boilerplate telltales).

All balances are simulated ledger numbers. No real money.

## 2. Architecture Summary

- **Backend:** WordPress plugin, PHP 7.4+ (8.x compatible), WP 5.8+.
- **Frontend:** Reuse the existing React app (`client/`), compiled with Vite and
  shipped in the plugin (`public/app/`). Un-minified source also shipped (`src/`)
  for auditability. WebSockets replaced with AJAX polling.
- **Auth:** Dedicated plugin user table + custom cookie sessions + nonces.
  Login/register via shortcode pages. REST authenticated by cookie + `X-WP-Nonce`.
- **Data:** Custom tables via `$wpdb->prepare`. Configuration stored as a single
  WP option (`mxt_settings`) edited through the Settings API.
- **Scheduling:** WP-Cron (price engine, signal resolution, futures liquidation,
  cleanup). Intervals configurable; real-cron instructions documented.

## 3. Plugin Identity

| Item | Value |
| --- | --- |
| Display name | MASTER X — Simulated Crypto Trading |
| Slug / folder | `masterx-trading` |
| Text domain | `masterx-trading` |
| Function prefix | `mxt_` |
| Class prefix | `MXT_` |
| DB table prefix | `{wp}mxt_` |
| REST namespace | `mxt/v1` |
| Requires | WordPress 5.8+ |
| Requires PHP | 7.4+ |
| License | GPLv2+ (bundled MIT assets attributed) |

## 4. Plugin File Structure

```
masterx-trading/
├── masterx.php                 # Plugin header, constants, bootstrap
├── uninstall.php
├── readme.txt                  # WP plugin readme format
├── changelog.txt
├── LICENSE.txt
├── includes/
│   ├── class-mxt-plugin.php    # Core bootstrap, hooks, activation
│   ├── class-mxt-install.php   # Tables, defaults, cron scheduling
│   ├── class-mxt-settings.php  # Option registry + sanitization
│   ├── class-mxt-db.php        # $wpdb repositories
│   ├── class-mxt-auth.php      # Sessions, cookies, password rules
│   ├── class-mxt-rest.php      # REST route registration + auth
│   ├── class-mxt-price-engine.php   # pure logic, no $wpdb
│   ├── class-mxt-trade-engine.php   # pure logic, no $wpdb
│   ├── class-mxt-copy-engine.php    # pure logic, no $wpdb
│   ├── class-mxt-referrals.php      # pure logic, no $wpdb
│   ├── class-mxt-kyc.php            # upload handling + status rules
│   ├── class-mxt-cron.php      # WP-Cron handlers
│   ├── class-mxt-shortcodes.php
│   └── class-mxt-assets.php    # Enqueue built bundle only on plugin pages
├── admin/
│   ├── class-mxt-admin.php     # Menu, list tables, AJAX row actions
│   └── views/                  # Settings / management page templates
├── public/
│   ├── index.php
│   └── app/                    # Compiled React bundle (committed)
├── src/                        # React source (committed, auditable)
├── assets/                     # Plugin icon, screenshots for ThemeForest
└── languages/
    └── masterx-trading.pot
```

## 5. Database Schema

All tables use `{$wpdb->prefix}mxt_`. Amounts stored as `DECIMAL(18,8)`.

- **mxt_users** — `id`, `email`, `password_hash` (wp_hash_password), `name`,
  `role` (`user`/`admin`), `status` (`active`/`banned`), `kyc_status`
  (`none`/`pending`/`approved`/`rejected`), `kyc_docs` (JSON paths),
  `kyc_message`, `payout_address`, `payout_network`, `referral_code`,
  `referred_by`, `balance`, `locked`, `total_deposited`, `total_withdrawn`,
  `total_profit`, `grace_ends_at`, `created_at`, `updated_at`.
- **mxt_sessions** — `id`, `user_id`, `token_hash`, `created_at`, `expires_at`,
  `ip`, `user_agent`.
- **mxt_transactions** — `id`, `user_id`, `type`
  (`deposit`/`withdrawal`/`trade_win`/`trade_loss`/`copy_win`/`copy_loss`/
  `commission`/`bonus`/`master_commission`), `amount`, `status`
  (`pending`/`completed`/`rejected`), `proof`, `address`, `gross`, `fee`,
  `tax`, `net`, `meta` (JSON), `reviewed_by`, `reviewed_at`, `created_at`.
- **mxt_trades** — `id`, `user_id`, `pair`, `side`, `margin`, `leverage`,
  `entry_price`, `exit_price`, `pnl`, `status` (`open`/`closed`/`liquidated`),
  `created_at`, `closed_at`.
- **mxt_signals** — `id`, `code`, `pair`, `side`, `duration_secs`,
  `valid_secs`, `return_pct`, `loss_pct`, `min_amount`, `max_amount`,
  `commission_pct`, `status` (`active`/`completed`/`cancelled`), `outcome`
  (`win`/`loss`), `expires_at`, `completes_at`, `result_message`, `created_at`.
- **mxt_copy_trades** — `id`, `signal_id`, `user_id`, `amount`, `status`,
  `pnl`, `commission`, unique per `signal_id + user_id`.
- **mxt_referrals** — `id`, `referrer_id`, `referred_id`, `bonus_paid`.
- **mxt_notifications** — `id`, `user_id`, `title`, `message`, `read`,
  `created_at`.

## 6. Configuration (Settings API)

Single option `mxt_settings` with per-tab sanitization. Tabs:

1. **Dashboard** — stats overview, health warnings (cron, migration).
2. **Admin Settings** — admin login URL slug, admin email, change admin
   password, enable demo mode + "load demo data" button.
3. **User Settings** — login page slug, register page slug, post-login
   redirect, registration open/close, default starting balance,
   withdrawal grace days.
4. **Trading Settings** — tradable pairs (default 6: BTC/USDT, ETH/USDT,
   SOL/USDT, BNB/USDT, XRP/USDT, DOGE/USDT), leverage range,
   deposit address + networks, deposit fee/tax, withdrawal fee/tax,
   signal min/max amount, copy commission %, referral rank thresholds
   (5 tiers) + bonuses.
5. **Cron Settings** — intervals for price/signal/trade/cleanup, Binance
   sync toggle, "run now" per job, last-run timestamps.

## 7. Authentication & Sessions

- Shortcode forms `[masterx_login]`, `[masterx_register]` post to
  `admin-post.php` actions with `wp_verify_nonce`.
- Session token generated server-side, hashed, stored in `mxt_sessions`;
  HttpOnly cookie holds the raw token. Cookie scoped to site.
- Password hashing via `wp_hash_password` / `wp_check_password`.
- Admin is a plugin-role user (email + password set in Admin Settings).
- REST: cookie auth + `X-WP-Nonce` header (`wp_rest`). Admin REST routes
  additionally check plugin admin role.

## 8. REST API (namespace `mxt/v1`)

- `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/profile`
- `/wallet/deposit`, `/wallet/withdraw`, `/wallet/transactions`
- `/market/prices`, `/market/pairs`
- `/trades` — open, close, history
- `/copy/signals`, `/copy/join`, `/copy/history`
- `/referral` — link, rank progress, referrals, commissions
- `/kyc` — submit (wp_handle_upload), status
- `/notifications` — list, mark read
- `/admin/*` — analytics, users, KYC review, deposit/withdrawal review,
  signal management, settings (writes also via admin-post AJAX)

## 9. WP-Cron Jobs

| Job | Default interval | Work |
| --- | --- | --- |
| `mxt_price_cron` | 60s | Random-walk prices; optional Binance sync |
| `mxt_signal_cron` | 30s | Resolve signals, credit wins/losses + master commission + referral effects |
| `mxt_trade_cron` | 60s | Open-futures liquidation checks |
| `mxt_cleanup_cron` | daily | Expired sessions, old notifications |

Docs include real-cron setup (`define('DISABLE_WP_CRON', true);` + system crontab)
for accurate signal timing.

## 10. Business Logic Port (same rules as Node app)

- **Deposit:** upload proof → pending → admin approve credits balance and
  records `total_deposited`; referrer earns rank-based deposit commission plus
  fixed first-deposit bonus.
- **Withdrawal:** gross deducted on request; `net = gross - fee - tax`;
  reject refunds gross; admin marks fulfilled.
- **Independent futures:** margin locked; PnL from live price × leverage; loss
  capped at margin; auto-liquidation at -100%.
- **Copy trading:** admin drops time-limited code; users join before expiry;
  on completion wins credit `amount + netPnl` minus master commission; losses
  deduct loss % and refund remainder.
- **Referral tiers:** 5 ranks by successful referral counts (10/25/50/100),
  each raising deposit- and profit-share percentages. Automatic crediting.
- **KYC:** identity upload, admin approve/reject with custom message.
- **Grace hold:** new users subject to withdrawal grace (configurable days);
  day-0 exemption and admin override/clear preserved.

Pure logic (pricing walk, PnL, commissions, rank thresholds, grace checks)
resides in standalone classes free of `$wpdb`, unit-testable in isolation.

## 11. Frontend Integration

- Workspace layout: plugin sources live at `wordpress-plugin/masterx-trading/`.
  The React frontend source is copied from the Node app's `client/` into the
  plugin's `src/` (canonical source going forward), retargeted, and built into
  `public/app/`.
- Reuse the existing React app unchanged in UI/animation.
- `api.js`: base URL `rest_url('mxt/v1')`, `X-WP-Nonce` header injected from a
  localized global.
- `ws.js`: replaced by a polling hook — prices ~2s, balances/notifications
  ~15–30s — same ticker/price-update animations.
- TradingView widget embed retained.
- Vite build outputs to `public/app/`; enqueued only when the current page is
  a plugin page (slug match), with versioned asset URLs.
- Bundle + source committed; build command + instructions in docs/readme.

## 12. ThemeForest / Envato Review Readiness

- All inputs sanitized; all output escaped (`esc_html`, `esc_attr`, `esc_url`,
  `wp_kses`); SQL via `$wpdb->prepare`.
- Nonces on all forms and REST writes; capability/role checks on every
  admin action; uploads validated (type/size).
- i18n complete: `__()`, `_e()`, `esc_html__()`; text domain loaded;
  `masterx-trading.pot` shipped.
- Unique prefixes, no short tags, no `eval`, no external remote calls except
  optional Binance public API and TradingView widget.
- Proper enqueueing (no global pollution), Settings API for options.
- Bundled assets licensed (MIT) and attributed in `LICENSE.txt`.
- Deliverables: `readme.txt`, `changelog.txt`, `LICENSE.txt`, screenshots,
  `.pot`, docs (install, config, cron, rebuild instructions).

## 13. Code Style (human-readability)

- Idiomatic, professional WP style consistent with WordPress Coding Standards.
- Real, purposeful docblocks; no explanatory filler; no boilerplate telltales.
- Naturally varied formatting; no AI-ish uniform block generation.
- Class-per-file, `class-mxt-*.php` naming; strict no-comment-dumping policy.

## 14. Build Phasing

1. Core skeleton — `masterx.php`, install tables, option registry, menu shell,
   shortcodes, asset enqueue.
2. Custom auth — sessions, login/register forms, REST auth.
3. Wallet — deposits/withdrawals/transactions + admin review screens.
4. Market + futures engine + price cron.
5. Copy engine + signal cron.
6. Referrals + KYC.
7. Admin dashboard/analytics + reports.
8. React frontend retarget (api.js/ws.js) + Vite build into plugin.
9. Review-readiness pass — i18n, escaping audit, readme/changelog/license/
   screenshots, `php -l` lint, unit tests for pure logic.

Each phase ends with a verifiable milestone.

## 15. Verification Strategy

- `php -l` on every PHP file.
- Unit tests (plain PHP, no WP runtime) for price engine, trade engine,
  copy engine, referral tiers, grace logic via a small test harness.
- Stand up WordPress locally in the sandbox if resources allow (PHP + MySQL
  or WP SQLite drop-in) for smoke tests; otherwise document a GitHub Actions
  WP integration test workflow and manual QA checklist.
- Manual acceptance checklist mapped from Node-app verification
  (login, register, deposit/approve, futures open/close, copy join/resolve,
  referral commission, KYC, admin actions, settings round-trip).

## 16. Out of Scope (v1)

- WebSockets (replaced by polling; shared WP hosts cannot hold sockets).
- Native WordPress user integration (dedicated plugin users only).
- Real payment gateways (manual deposit/withdrawal workflow only).
- Multi-currency/theme-compat beyond a standalone shortcode page.
