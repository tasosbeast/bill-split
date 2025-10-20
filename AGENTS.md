# AGENTS.md

> Purpose: give AI assistants the context they need to work safely in this repo - what the app does, where logic lives, how to run checks, and which contracts must stay stable. Keep this concise and accurate.

---

## Project Overview

- **Name:** Bill Split
- **Mission:** Track shared expenses with friends, settle balances, and surface analytics (trends, budgets, category insights).
- **Primary user flows:**
  1. Manage the friend list (add, edit, remove).
  2. Create and edit split transactions or settlements.
  3. Review analytics dashboards (monthly trends, category breakdowns, balances).
  4. Persist everything to `localStorage` for a fast, offline-friendly UX.

---

## Tech & Runtime

- **Framework:** React 19 plus Vite 7.
- **Language:** Mixed TypeScript and modern JavaScript. Prefer TypeScript (or JSDoc with clear types) when adding new modules.
- **State:** Legacy UI state is managed inside `src/App.jsx`. Normalized transaction and budget state for analytics lives in `src/state/transactionsStore.ts` with a publish/subscribe pattern and persistence helpers.
- **Styling:** CSS Modules plus global styles in `src/index.css`. Follow the module naming conventions already used in `src/components`.
- **Linting:** ESLint via `npm run lint` (see `eslint.config.js`). There is no Prettier config; match the prevailing style and rely on ESLint autofix when possible.
- **Testing:** Vitest (`npm test`) with suites under `src/utils/__tests__`. Add coverage around analytics or state logic before major refactors.
- **Node:** Target Node 18 or newer (Node 20 LTS is a safe choice).

---

## Repository Layout

```
src/
  assets/          # Static images and icons
  components/      # Reusable UI (Analytics*, Transactions, Modals, etc.)
  lib/             # Domain utilities (money, storage, analytics JS helpers)
  state/           # Transaction store and persistence helpers (TypeScript)
  types/           # Shared TypeScript declarations
  utils/           # TypeScript analytics utilities plus tests
```

- Entry point: `src/main.jsx` renders `<App />` from `src/App.jsx`.
- Analytics logic exists in both `src/lib/analytics.js` (legacy JS used by the current UI) and `src/utils/analytics.ts` (typed utilities under test).

---

## Commands

```bash
npm install         # Install dependencies (package-lock.json is authoritative)
npm run dev         # Start Vite dev server
npm run build       # Production build
npm run preview     # Preview production build locally
npm run lint        # ESLint (fails on warnings)
npm test            # Vitest (single run)
```

> There are no dedicated `format` or `typecheck` scripts. Run the TypeScript compiler manually if needed (`npx tsc --noEmit`).

---

## Environment

- No `.env` files are required today. The app is 100 percent client-side.
- If future features require API keys or endpoints, add `.env.example` and document the variables here.

---

## Storage Contracts

1. **UI snapshot (`src/lib/storage.js`):**

   - **Key:** `bill-split@v1`
   - **Payload:** `{ friends: Friend[], selectedId: string | null, transactions: Transaction[] }`
   - Transactions follow the normalized shape returned by `buildSplitTransaction` in `src/lib/transactions.js` (participants, effects, metadata).

2. **Analytics store (`src/state/persistence.ts`):**
   - **Key:** `bill-split:transactions`
   - **Payload:** `{ transactions: PersistedTransaction[], budgets: Record<string, number> }`
   - Values are sanitized on read and write (rounding to cents, keeping valid participant entries only).

Guardrail: If either schema changes, provide an upgrade path (`upgradeTransactions` handles legacy splits) or bump the storage key when migration is not possible.

---

## Agents & Responsibilities

| Agent                  | Responsibility                                                  | Implementation                                                                 | Inputs                               | Outputs                                                                             | Status                           |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------- |
| Transactions Agent     | Normalize, store, and broadcast transactions and budgets.       | `src/state/transactionsStore.ts`, `src/state/persistence.ts`                   | Raw persisted payloads, UI mutations | In-memory `TransactionsState`, persistence side effects                             | Active                           |
| Analytics Agent        | Compute spend totals, monthly buckets, and comparisons.         | `src/utils/analytics.ts`, `src/utils/__tests__/analytics.test.ts`              | Sanitized transactions, budgets      | `totalSpendPerCategory`, `monthlySpendPerCategory`, `compareBudgetByCategory`, etc. | Active                           |
| Legacy Analytics Agent | Supply dashboard-ready aggregates for current React components. | `src/lib/analytics.js`                                                         | UI snapshot transactions             | Category totals, breakdowns, friend balances                                        | Active (until TS port completes) |
| Balances Agent         | Determine friend balances and settlements for UI cards.         | `src/lib/analytics.js` (`computeFriendBalances`)                               | Transaction effects                  | Sorted friend balance list                                                          | Active                           |
| UI Orchestrator        | Compose agent outputs into dashboard and transactions UI.       | `src/App.jsx`, `src/components/AnalyticsDashboard.jsx`, `src/components/Analytics*` | Selectors, agent outputs             | Rendered React views                                                                | Active                           |

Status legend: Active = implemented, In Progress = being built, Planned = design only.

When adding a new agent, define its loop (inputs and outputs), implement it in isolation, protect it with tests, expose it through a selector or hook, and update this table.

---

## Guardrails

- Preserve public component APIs in `src/components`; update every call site and CSS module if props change.
- Keep `CATEGORIES` (`src/lib/categories.js`) authoritative. Normalization helpers rely on the canonical list.
- Protect the localStorage keys above; add migrations before mutating stored shapes.
- Maintain accessibility affordances (modal focus trap, keyboard support, aria-live announcements).
- Avoid introducing `eval`, dynamic script injection, or unchecked HTML rendering.

---

## Testing & Verification

- Run `npm run lint`, `npm test`, and `npm run build` before opening pull requests.
- Add Vitest coverage for analytics math or selector logic when touching those files.
- Manual QA: confirm transactions persist and reload, analytics dashboards render, and balances update after edits.
- For bug fixes, create a failing test first whenever practical.

---

## Suggested Codex Tasks

1. **Health audit:** Run lint, test, and build; summarize failures and propose targeted fixes.
2. **Analytics hardening:** Add edge-case tests (null totals, unknown categories) or port additional JS helpers to TypeScript incrementally.
3. **Performance trims:** Memoize heavy list rendering in analytics components or split bundles if initial load grows.
4. **Accessibility polish:** Verify keyboard and focus handling in modals and analytics cards; add tests or utilities if gaps are found.
5. **Persistence resilience:** Expand error handling for storage adapters and add migration regression tests.

Always attach diffs and explain trade-offs when proposing changes.

---

## Non-Goals (Current)

- Multi-user sync or server-side persistence.
- Payment processing integrations.
- Real-time collaboration or shared sessions.

---

## Maintainers

- Tasos (owner). Add additional maintainers here as the team grows.

---

## Last Verified

- Update this date whenever you edit this file.
- **YYYY-MM-DD:** 2025-10-20
