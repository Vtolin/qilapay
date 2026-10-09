# QilaPay — Remittance on Tempo Testnet

International money transfer web app that settles funds on **Tempo Testnet
(Moderato)** in seconds, with transparent rates and **adaptive KYC**:
verification steps up only when needed.

> **Testnet demo.** No real money. KYC providers are simulated. A "Testnet Demo"
> banner shows on every page.

---

## Verified end to end on Moderato

| # | Scenario | Result |
|---|---|---|
| 1 | Sari sends $20 | `ALLOW` → settled in about 1 to 3s, **no KYC screen** |
| 2 | Sari sends $200 | `STEP_UP` (LIMIT_PER_TX, LIMIT_ROLLING_30D, NEW_RECIPIENT_LARGE) → pick a method → Simulate: Approve → transfer continues automatically + tier upgrade |
| 3 | Dewi (velocity history) | `STEP_UP` VELOCITY_HIGH even though the amount is small |
| 4 | Recipient on the screening list | `HOLD_REVIEW` → admin approves or rejects in the console → onchain execution |
| 5 | IDR → EUR | 60s locked rate + countdown, **Treasury fallback** mode (DEX has no non-USD pair), 2 onchain legs |
| 6 | Recipient on the sanctions list | Automatic `BLOCK` (SANCTIONS_BLOCK) |

Every settled transfer has a **tx hash that opens in the explorer**, an onchain
memo `QILA-<id>` matching the DB record, and accurate settlement timing
("Settled in X.XXs").

## Run it

```bash
npm install          # or: bun install
npm run dev          # dev server on port 3000 (also try: bun run dev)
```

Only `db:push` if you start from an empty database:

```bash
npm run db:push      # push the Prisma schema (SQLite)
```

### The `.env` file (read this first)

The app **will not work without `.env`** (it is gitignored, so a fresh clone
has none). Symptom of a missing file: **"Try demo" returns 403**
(`Persona login is only available in demo mode`), because persona login
requires `DEMO_MODE=true`.

Fastest fix: copy the ready made env from the bundle (it also holds a
pre-seeded database):

```bash
cp download/qilapay-source.zip .   # already in the repo
# unzip and copy its .env to the project root, then restart the dev server
```

`.env` must contain at least:

```
DATABASE_URL=file:../db/custom.db
DEMO_MODE=true                   # enables persona login + provider simulation
```

Full local setup adds `TEMPO_*` RPC values (public defaults are built in),
`TREASURY_PRIVATE_KEY`, `WALLET_ENCRYPTION_KEY`, and `SESSION_SECRET`.
Restart the dev server after creating or changing `.env` (Next.js loads it
at boot).

Open the app → click **"Try demo"** (signs in as Sari) or use the **Demo**
page. First seed issues qIDR/qSGD/qEUR/qGBP via the TIP-20 Factory, funds
the treasury from the faucet, and creates 4 personas.

### Fast login (personas)

| Persona | Tier | Used for |
|---|---|---|
| `sari@qilapay.demo` | 0 | small sends pass / large sends step up |
| `budi@qilapay.demo` | 2 | cross currency transfers with no friction |
| `dewi@qilapay.demo` | 0 | velocity trigger |
| `admin@qilapay.demo` | 2 (admin) | compliance console |

Persona login skips passwords (demo mode only). New account registration
(password min. 8 characters) creates a custodial wallet funded from the faucet.

Signed-in visitors to `/` go straight to `/dashboard` (`LandingGuard`);
signed-out visitors to any app page go to `/login` (`AppGuard`).

## Routes (multi-route App Router)

| Route | Page |
|---|---|
| `/` | Landing: hero, features, control, automation, how it works, CTA |
| `/login`, `/register` | Email plus password auth, one-click demo personas |
| `/how-it-works` | Four step explainer |
| `/dashboard` | Live onchain balances per currency, tier limit progress, recent transfers, top up |
| `/send` | Wizard: quote (60s locked rate + countdown) → compliance/step-up → result. Demo scenarios prefill via query string |
| `/transactions`, `/transactions/[id]` | History + detail with event timeline and explorer links |
| `/wallet` | Deposit address, live balances, faucet and treasury top up |
| `/verification` | Tier ladder, methods, history, Simulate buttons (DEMO_MODE) |
| `/recipients` | QilaPay users by email or external Tempo wallets |
| `/admin` | Review queue, transfer monitor, risk decisions + snapshots, tier/limit/spread/corridor editor |
| `/demo` | One-click personas, 6 ready scenarios, reset, 3 minute script, tech summary |

## Architecture

- **Frontend**: Next.js 16 App Router + TypeScript + Tailwind 4 + shadcn/ui.
  Layered components: `brand/` (design system), `landing/` (marketing sections),
  `layout/` (session-aware header/footer), `auth/` (forms), `app/` (route screens),
  `qila/` (domain views). Route state lives in the URL (e.g. send prefills),
  no global client store.
- **Backend**: Next.js API routes (`src/app/api/*`) + Prisma (SQLite).
  All sensitive work (key decryption, onchain execution) stays on the server.
- **Blockchain**: `viem` + `viem/tempo` module (Actions.token, Actions.dex, Abis, Addresses).
- **Rates**: Frankfurter API (ECB, no API key), 5 minute cache in `fx_rates`.

### Transfer execution (spec 6.4)

```
same-ccy : user wallet --transferWithMemo--> recipient            (1 tx)
cross-ccy: try DEX quote (Stablecoin DEX 0xdec0…)
           +- pair available : user swaps via DEX, then pays recipient
           +- PairDoesNotExist / InsufficientLiquidity (the live case):
                user --debit--> treasury --credit q<CCY>--> recipient  (2 tx)
```

- Onchain memo: `QILA-<last 10 chars of transfer id>` (32-byte, readable in the explorer).
- Tx fees come from the wallet stablecoin balance (wallets are faucet funded at
  creation); the treasury issues q-tokens, so inventory can be topped up (mint)
  before credit.
- `executionMode` is shown honestly in the UI: `Tempo DEX` / `Treasury fallback` / `Direct transfer`.

### Security

- Wallet private keys encrypted with **AES-256-GCM** (`WALLET_ENCRYPTION_KEY`),
  decrypted only on the server during execution. Never sent to the browser.
- Service-role operations (execution, mint, faucet) only through API routes.
- HMAC-signed httpOnly session cookie. Auth enforced server-side per route
  (`requireUser` / `requireAdmin`); client guards are UX only.
- Rate limits on auth, funding, and FX refresh (in-memory, single instance).

## Environment variables

```
DATABASE_URL=file:../db/custom.db
TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz
TEMPO_CHAIN_ID=42431
TEMPO_EXPLORER_URL=https://explore.testnet.tempo.xyz
TEMPO_FAUCET_URL=https://tempo.xyz/developers/api/faucet
TREASURY_PRIVATE_KEY=0x…         # treasury/issuer wallet (testnet burner only)
WALLET_ENCRYPTION_KEY=…          # AES key derivation (32 byte hex, no fallback)
SESSION_SECRET=…                 # session HMAC (dev fallback with warning)
DEMO_MODE=true                   # enables persona login + Simulate buttons
```

## Onchain addresses (Moderato, chain 42431)

| Token | Address |
|---|---|
| pathUSD (USD) | `0x20c0000000000000000000000000000000000000` |
| qIDR | `0x20c000000000000000000000b975a83327b8af05` |
| qSGD | `0x20c000000000000000000000335b00c2a7a01925` |
| qEUR | `0x20c0000000000000000000002a21872b909c9e5c` |
| qGBP | `0x20c0000000000000000000002942fd521bffd2f8` |

Predeploys used: TIP-20 Factory `0x20fc…0000`, Stablecoin DEX `0xdec0…0000`.
Faucet: `POST https://tempo.xyz/developers/api/faucet` or RPC `tempo_fundAddress`.

Token addresses also render live on the **Demo → Technical summary** page (from DB).

## Database schema (Prisma, Supabase-spec equivalent)

`User` (+`UserRole`), `KycTierConfig`, `KycVerification`, `Wallet`, `Currency`,
`FxRate`, `Recipient`, `Quote`, `Transfer` (+`TransferEvent`), `RiskDecision`,
`ScreeningEntry`, `AppConfig`, `AuditLog`. Rolling 30-day usage is computed via
the `Transfer → Quote.usdEquivalent` join (equivalent of view `v_rolling_usage`).

**All business numbers come from the database/config** — tier limits
(`kyc_tier_config`), spread and fee (`app_config`: `fx_spread_bps`, `fee_bps`),
velocity thresholds, new-recipient rules, risk corridors — editable by admins
in the console with no redeploy.

## Decision engine (spec 5.3)

`evaluateTransfer()` → `ALLOW | STEP_UP (+methods) | HOLD_REVIEW | BLOCK`
with reason codes + input snapshots stored in `risk_decisions`:

- `LIMIT_PER_TX`, `LIMIT_ROLLING_30D` → step up to the lowest sufficient tier
- `VELOCITY_HIGH` (3+ transfers / 10 min), `NEW_RECIPIENT_LARGE` → step up
- `CORRIDOR_RISK`, `SCREENING_HIT` → hold for review
- `SANCTIONS_BLOCK` → block

The **"Why am I asked to verify?"** panel shows reason codes in plain language.
Alternative verification methods: selfie liveness, age estimation, ID + face
match, bank micro-deposit, proof of address, source of funds, video call.

## Out of scope

Real money, production KYC providers, regulatory compliance (licensing, travel
rule), mainnet, bank off-ramps, native mobile apps. The `KycProvider` interface
is ready to swap to a Persona/Sumsub sandbox without changing the flow.

## Implementation notes vs spec

- Supabase maps to Prisma/SQLite + cookie auth (no Supabase in this environment).
  RLS maps to per-query `userId` filters + admin guards on admin routes.
- Auth is cookie session (HMAC, httpOnly, 7-day TTL), verified server-side.
- Core milestones (3, 5, 6, 8) run end to end, verified in browser + onchain.
