# AGENTS.md

> Purpose: give AI assistants the context they need to work safely in this repo - what the app does, where logic lives, how to run checks, and which contracts must stay stable. Keep this concise and current.

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
- **Language:** TypeScript (strict mode) for all new code. Core utilities (`src/lib/*.ts`) and state management (`src/state/*.ts`) are fully typed. UI components remain primarily `.jsx` for incremental migration.
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
  components/      # Reusable UI (Analytics*, Transactions, Modals, etc.) - primarily JSX
  lib/             # Domain utilities (TypeScript: money, compute, selectors, transactions, categories, filters)
  state/           # Transaction store and persistence helpers (TypeScript)
  types/           # Shared TypeScript declarations
  utils/           # TypeScript analytics utilities plus tests
```

- Entry point: `src/main.jsx` renders `<App />` from `src/App.jsx`.

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

## Data Flow

```
User Action
    ↓
UI Component (App.jsx)
    ↓
Transaction Creation/Edit
    ↓
├─→ UI State Update (setState in App.jsx)
│   └─→ localStorage write (bill-split@v1)
│
└─→ Transactions Store (transactionsStore.ts)
    └─→ Sanitization & Normalization
        └─→ localStorage write (bill-split:transactions)
            └─→ Subscribers notified (analytics components)
                └─→ Analytics calculations (analytics.ts)
                    └─→ UI re-render with insights
```

---

## Agents & Responsibilities

| Agent              | Responsibility                                                | Implementation                                                                      | Inputs                               | Outputs                                                                                               | Status                     |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| Transactions Agent | Normalize, store, and broadcast transactions and budgets.     | `src/state/transactionsStore.ts`, `src/state/persistence.ts`                        | Raw persisted payloads, UI mutations | In-memory `TransactionsState`, persistence side effects                                               | Active                     |
| Analytics Agent    | Compute spend totals, monthly buckets, and comparisons.       | `src/utils/analytics.ts`, `src/utils/__tests__/analytics-legacy-port.test.ts`       | Sanitized transactions, budgets      | All analytics functions: overview, category breakdown, monthly trends, friend balances, budget status | Active                     |
| Balances Agent     | Determine friend balances and settlements for UI cards.       | `src/lib/analytics.js` (`computeFriendBalances`)                                    | Transaction effects                  | `Map<friendId, { balance, owedTo, owedFrom }>`                                                        | Active                     |
| UI Orchestrator    | Compose agent outputs into dashboard and transactions UI.     | `src/App.jsx`, `src/components/AnalyticsDashboard.jsx`, `src/components/Analytics*` | Selectors, agent outputs             | Rendered React components                                                                             | Active (needs refactoring) |
| Settlement Agent   | Calculate and create settlement transactions between friends. | `src/lib/transactions.js` (`buildSplitTransaction`)                                 | Friends list, balances               | Settlement transaction objects                                                                        | Active                     |

Status legend: Active = implemented, Deprecated = scheduled for removal, In Progress = being built, Planned = design only.

When adding a new agent, define its loop (inputs and outputs), implement it in isolation, protect it with tests, expose it through a selector or hook, and update this table.

---

## Completed Migrations

**Analytics Consolidation:** ✅ **COMPLETE**

- **Completed:** All analytics functions migrated to TypeScript
  - Implementation: `src/utils/analytics.ts` (TypeScript, tested, type-safe)
  - Tests: 43 comprehensive test cases in `src/utils/__tests__/analytics-legacy-port.test.ts`
  - UI Integration: `AnalyticsDashboard.jsx` uses TypeScript implementation
- **Timeline:**
  - Phase 1 (PR #33): Ported 7 functions to TypeScript with full test coverage
  - Phase 2 (PR #36): Updated UI components to use TypeScript implementation
  - Phase 3 (PR #[this PR]): Removed legacy code and updated documentation
- **Benefits:**
  - Single source of truth for analytics calculations
  - Full TypeScript type safety
  - 100% test coverage with comprehensive edge case handling
  - Improved maintainability and accuracy

**Core Utilities TypeScript Migration:** ✅ **COMPLETE** (Phase 1.6)

- **Completed:** All core `src/lib` utilities migrated to TypeScript
  - `categories.ts`: Typed CATEGORIES array
  - `money.ts`: Typed formatEUR and roundToCents with locale pinning
  - `compute.ts`: Typed computeBalances with TransactionLike interface
  - `selectors.ts`: Typed state selectors with safe property access
  - `transactionFilters.ts`: Typed filterTransactions with DateRange and TransactionFilters types
  - `useTransactionFilters.ts`: Typed React hook with explicit return types
- **Benefits:**
  - Eliminated type assertions in consuming hooks (useSettleUp, useFriendSelection, useFriends)
  - Improved IntelliSense and compile-time safety across 20+ import sites
  - Foundation for future component migrations to TSX
- **Remaining JS:** Only test files (`*.test.js`) and UI components (`*.jsx`) remain as JavaScript

**State Management:**

- **Current state:** Mixed approach with App.jsx holding UI state and transactionsStore for analytics.
- **Future consideration:** Evaluate context providers or lightweight state management (Zustand, Jotai) to eliminate prop drilling.

---

## Architectural Decisions

### Why localStorage instead of a backend?

- **Decision:** Keep app 100% client-side for privacy and simplicity.
- **Trade-offs:** No sync across devices, quota limits (~5-10MB), no server-side analytics.
- **Revisit when:** Users request multi-device sync or collaboration features.

### Why two analytics systems?

- **Decision:** ~~Incremental rewrite to TypeScript with proper testing.~~ **RESOLVED:** Migration completed in Phase 1.6.
- **Status:** Single TypeScript implementation in `src/utils/analytics.ts`.

### Why React 19?

- **Decision:** Adopt latest stable for better concurrent features and automatic batching.
- **Trade-offs:** Cutting edge may have ecosystem lag (e.g., some libraries not updated).
- **Monitoring:** Watch for hydration warnings and Suspense edge cases.

---

## Guardrails

### ✅ Safe to change:

- Adding new components to `src/components/`
- Extending analytics utilities in `src/utils/` (with tests)
- Improving CSS styling (maintain mobile responsiveness)
- Optimizing performance (measure before/after)
- Adding JSDoc type hints to JavaScript files

### ⚠️ Requires review:

- Modifying transaction normalization logic
- Changing localStorage schema or keys
- Refactoring App.jsx state management
- Updating ESLint rules

### ❌ Do not change without explicit approval:

- `src/lib/transactions.ts` core splitting algorithm
- Storage keys (`bill-split@v1`, `bill-split:transactions`)
- Test expectations (fix the code, not the tests)
- React/Vite versions (ensure compatibility first)
- `CATEGORIES` list in `src/lib/categories.ts` (normalization depends on it)

### General principles:

- Preserve public component APIs in `src/components`; update every call site and CSS module if props change.
- Protect the localStorage keys above; add migrations before mutating stored shapes.
- Maintain accessibility affordances (modal focus trap, keyboard support, aria-live announcements).
- Avoid introducing `eval`, dynamic script injection, or unchecked HTML rendering.

---

## Common Pitfalls

1. **Floating point arithmetic:** Always use integer cents internally. Use helper functions from `src/lib/money.js` for rounding.

2. **Dual state updates:** When modifying transactions, update BOTH:

   - App.jsx state (for immediate UI)
   - transactionsStore (for analytics)

   Missing either causes inconsistencies.

3. **localStorage quota:** No current limits enforced. Consider adding size warnings if transaction count > 1000.

4. **Time zones:** All dates should be stored as ISO 8601 strings. Display formatting happens in components.

5. **Schema evolution:** Before changing `Transaction` or `Friend` types:

   - Write migration function in `src/state/persistence.ts`
   - Add version field to persisted data
   - Test upgrade path with realistic legacy data

6. **ESLint warnings = failures:** The CI pipeline treats warnings as errors. Fix all linting issues before committing.

---

## Testing & Verification

### Testing Requirements

**Must have tests for:**

- ✅ Analytics utilities (`src/utils/*.ts`)
- ✅ State store logic (`src/state/*.ts`)
- ⚠️ Transaction creation/splitting logic (add before refactoring)
- ❌ UI components (not yet implemented)

**Coverage targets:**

- Utilities: 90%+ line coverage
- State management: 85%+ line coverage
- Transaction logic: 80%+ line coverage

**Testing principles:**

- Test behavior, not implementation
- Mock localStorage for state tests
- Use descriptive test names (e.g., `should calculate correct balances when multiple friends split unevenly`)
- For bug fixes, create a failing test first whenever practical

### Before opening pull requests:

- Run `npm run lint`, `npm test`, and `npm run build`
- Add Vitest coverage for analytics math or selector logic when touching those files
- Manual QA: confirm transactions persist and reload, analytics dashboards render, and balances update after edits

---

## Quick Reference

### How to add a new analytics metric:

1. Add calculation function to `src/utils/analytics.ts`
2. Export type in `src/types/index.ts` if needed
3. Write tests in `src/utils/__tests__/analytics.test.ts`
4. Subscribe to store in your component:
   ```typescript
   useEffect(() => {
     const unsubscribe = transactionsStore.subscribe((state) => {
       const metric = calculateNewMetric(state.transactions);
       setMetric(metric);
     });
     return unsubscribe;
   }, []);
   ```

### How to modify a transaction:

```javascript
// 1. Update UI state
setTransactions((prev) =>
  prev.map((t) => (t.id === targetId ? { ...t, amount: newAmount } : t))
);

// 2. Update analytics store
transactionsStore.updateTransaction(targetId, { amount: newAmount });
```

### How to debug localStorage issues:

```javascript
// In browser console:
localStorage.getItem("bill-split@v1"); // UI state
localStorage.getItem("bill-split:transactions"); // Analytics state
```

---

## Suggested Codex Tasks

1. **Health audit:** Run lint, test, and build; summarize failures and propose targeted fixes.
2. **Analytics hardening:** Add edge-case tests (null totals, unknown categories) or extend TypeScript utilities with deeper type coverage.
3. **Performance trims:** Memoize heavy list rendering in analytics components or split bundles if initial load grows.
4. **Accessibility polish:** Verify keyboard and focus handling in modals and analytics cards; add tests or utilities if gaps are found.
5. **Persistence resilience:** Expand error handling for storage adapters and add migration regression tests.
6. **JSX → TSX migration:** Incrementally convert UI components to TSX starting with forms and modals that have rich prop interfaces.

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
- **YYYY-MM-DD:** 2025-11-12
