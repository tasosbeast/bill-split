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
- **Language:** TypeScript (strict mode) for all new code. Core utilities (`src/lib/*.ts`) and state management (`src/state/*.ts`) are fully typed. High-value UI components (forms, modals, lists) have been migrated to `.tsx`. Remaining presentational and complex stateful components are `.jsx` for incremental migration.
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
npm run build:analyze # Build and open bundle visualization
npm run preview     # Preview production build locally
npm run lint        # ESLint (fails on warnings)
npm test            # Vitest (single run)
npm run size        # Check bundle sizes against limits
npm run size:why    # Analyze what's contributing to bundle size
```

> There are no dedicated `format` or `typecheck` scripts. Run the TypeScript compiler manually if needed (`npx tsc --noEmit`).

---

## Bundle Size Monitoring

Bundle size is monitored using two complementary tools:

### 1. Bundle Visualization (`rollup-plugin-visualizer`)

After each build, a treemap visualization is generated at `dist/stats.html` showing:

- Component and dependency sizes
- Gzipped and Brotli sizes
- Interactive exploration of bundle composition

**Usage:**

```bash
npm run build         # Generates dist/stats.html
npm run build:analyze # Builds and opens stats.html (macOS/Linux)
```

Open `dist/stats.html` in a browser to explore the bundle interactively. Use this to:

- Identify large dependencies that could be optimized
- Spot duplicate dependencies
- Verify code-splitting is working as expected

### 2. Size Limits (`size-limit`)

Enforces maximum bundle sizes configured in `.size-limit.json`:

```json
{
  "Main bundle (index)": "150 KB gzipped",
  "React vendor chunk": "65 KB gzipped",
  "Transactions chunk": "10 KB gzipped",
  "Total bundle size": "200 KB gzipped"
}
```

**Usage:**

```bash
npm run size        # Check sizes (fails if over limit)
npm run size:why    # Analyze what's making bundles large
```

**Size limits rationale:**

- **Main bundle**: Application code excluding vendors (current: ~2 KB, limit: 150 KB)
- **React vendor**: React + React DOM + Scheduler (current: ~60 KB, limit: 65 KB)
- **Transactions chunk**: Split transaction logic (current: ~1.5 KB, limit: 10 KB)
- **Total**: All JavaScript combined (current: ~117 KB, limit: 200 KB)

**When to update limits:**

1. After major feature additions, review actual sizes and adjust limits by ~10-20% headroom
2. If migration impacts bundle size, document the change and update limits accordingly
3. Always keep total bundle under 200 KB gzipped for good mobile performance

**Integration with CI:**
Add `npm run size` to CI pipeline to fail builds that exceed limits. This prevents bundle bloat from creeping in unnoticed.

---

## Environment

- No `.env` files are required today. The app is 100 percent client-side.
- If future features require API keys or endpoints, add `.env.example` and document the variables here.

---

## Error Tracking (Sentry)

Client-side error tracking is integrated via Sentry and is disabled by default. It only activates when a DSN is provided.

- Config: `.env` or build environment

  - `VITE_SENTRY_DSN` — Sentry DSN (empty disables tracking)
  - Optional: `VITE_APP_VERSION` — release identifier
  - Optional (source maps upload during CI): `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_RELEASE`

- Initialization: `src/services/errorTracking.ts` (no-op if DSN missing)

  - Safe defaults: tracesSampleRate = 0.05, replays disabled except on error
  - Privacy: basic scrubbing in `beforeSend` (no headers, no user email/username)

- React Error Boundary:

  - `src/components/ErrorBoundary.tsx` wraps the app in `src/main.jsx`
  - Shows a minimal fallback on runtime errors and reports to Sentry if enabled

- Vite Plugin (optional):

  - `@sentry/vite-plugin` conditionally enabled in `vite.config.js` when env vars are present
  - Builds continue normally without Sentry env configured

- Content Security Policy (CSP):
  - `index.html` includes `connect-src` directive allowing Sentry ingest endpoint
  - Required: `https://o4510348890800128.ingest.de.sentry.io` (or your project's ingest URL)
  - Without this CSP exception, error transmission will be blocked by the browser

Disable/Enable:

- To disable, leave `VITE_SENTRY_DSN` empty (default)
- To enable, set `VITE_SENTRY_DSN` and rebuild

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

**JSX→TSX Component Migration:** ✅ **COMPLETE** (Phase 2 - Tier 2 High-Value Components)

- **Completed:** 7 high-value components migrated to TypeScript (November 2025)
  - **Infrastructure (1):**
    - `Modal.tsx`: Render props with RefObject typing, keyboard trap, focus management
  - **Forms/Modals (3):**
    - `AddFriendModal.tsx`: Form validation, email checking, typed error states
    - `EditTransactionModal.tsx`: Complex validation logic, conditional amount editing
    - `BudgetManager.tsx`: Inline editing, category aggregation, keyboard handlers
  - **Complex Forms (1):**
    - `SplitForm.tsx`: 675 lines - participant management, template/recurring automation, split-evenly logic
  - **Lists (2):**
    - `FriendList.tsx`: Balance display, selection handlers, memoized rendering
    - `TransactionList.tsx`: Filter integration, settlement handlers, type-safe data flow
- **Key Patterns Established:**
  - Render props: `children: ReactNode | ((props: { firstFieldRef: RefObject<HTMLInputElement | null> }) => ReactNode)`
  - Type-safe event handlers: `FormEvent`, `ChangeEvent<T>`, `KeyboardEvent<T>`, `MouseEvent<T>`
  - Safe type conversions: Check for object types before `String()` conversion
  - Optional handler props: Settlement callbacks typed with `?` for flexibility
  - Map/Record compatibility: Helper functions to normalize data structures
  - Type assertions: `Parameters<typeof func>[0]` for complex filter compatibility
- **Benefits:**
  - Full IntelliSense for all form fields and event handlers
  - Compile-time validation of prop types and callbacks
  - Eliminated PropTypes dependencies in migrated components
  - Improved refactoring safety with typed interfaces
  - Better code navigation and documentation
- **Remaining JSX (26 files):**
  - **Tier 1 (Presentational):** Analytics components, filters (low complexity, defer)
  - **Tier 3 (Complex State):** App.jsx, Transactions.jsx, Balances.jsx (high complexity, defer)
- **Quality Gates:** All migrations validated with 0 lint errors, 174/174 tests passing, successful production builds

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

### Testing Infrastructure

**Test Runner:** Vitest 3.2.4

- Fast, ESM-native test runner with excellent TypeScript support
- Configuration in `vite.config.js` under `test` key
- Setup file: `src/test/setup.ts` (extends `expect` with `@testing-library/jest-dom` matchers)

**Testing Libraries:**

- `@testing-library/react` 16.3.0 - Component rendering and queries
- `@testing-library/user-event` 14.6.1 - User interaction simulation
- `@testing-library/jest-dom` 6.9.1 - DOM assertion matchers
- `jsdom` 27.0.1 - Browser environment simulation

**Coverage Tool:** `@vitest/coverage-v8`

- Provider: v8 (Node's built-in coverage engine)
- Reporters: text (console), json (CI integration), html (interactive reports)
- Output directory: `./coverage`
- Configuration highlights:
  - `reportOnFailure: true` - Preserves coverage even when tests fail
  - `clean: false` - Keeps previous coverage for comparison
  - Includes: `src/**/*.{js,jsx,ts,tsx}`
  - Excludes: Test files, `src/test/**` setup

### Commands

```bash
npm test                    # Run all tests (single run)
npm test -- --coverage      # Run tests with coverage report
npm test -- --watch         # Run tests in watch mode
npm test -- SomeFile.test   # Run specific test file
npm test -- --reporter=dot  # Use concise dot reporter
```

### Test Organization

**Directory Structure:**

```
src/
  components/__tests__/      # Component tests
  hooks/__tests__/          # React hooks tests
  lib/__tests__/            # Core utility tests
  state/__tests__/          # State management tests
  utils/__tests__/          # Analytics utility tests
```

**Naming Conventions:**

- Test files: `ComponentName.test.tsx` or `utilityName.test.ts`
- Test suites: `describe('ComponentName', () => { ... })`
- Test cases: `it('should [expected behavior] when [condition]', () => { ... })`

### Testing Patterns & Best Practices

#### 1. Component Testing

**Setup Pattern:**

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";

describe("ComponentName", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders with required props", () => {
    render(<ComponentName requiredProp="value" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

**Query Priority (following @testing-library best practices):**

1. `getByRole` - Accessible queries (preferred)
2. `getByLabelText` - Form inputs with labels
3. `getByPlaceholderText` - Inputs without labels
4. `getByText` - Non-interactive text content
5. `getByTestId` - Last resort escape hatch

**Scoped Queries with `within()`:**

```typescript
const container = screen.getByRole("region", { name: "Transaction List" });
const items = within(container).getAllByRole("listitem");
```

**Async Operations:**

```typescript
// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText("Loaded")).toBeInTheDocument();
});

// Wait for callback to be invoked
await waitFor(() => {
  expect(mockCallback).toHaveBeenCalledWith(expectedValue);
});
```

#### 2. User Interaction Testing

**Click Events:**

```typescript
const user = userEvent.setup();
await user.click(screen.getByRole("button", { name: "Submit" }));
```

**Form Input:**

```typescript
const user = userEvent.setup();
await user.type(screen.getByLabelText("Amount"), "42.50");
await user.clear(screen.getByLabelText("Notes"));
```

**Keyboard Navigation:**

```typescript
const user = userEvent.setup();
await user.keyboard("{Enter}");
await user.keyboard("{Escape}");
await user.tab();
```

#### 3. Mock Patterns

**Function Mocks:**

```typescript
const mockCallback = vi.fn();
render(<Component onSubmit={mockCallback} />);
expect(mockCallback).toHaveBeenCalledWith(expectedArg);
expect(mockCallback).toHaveBeenCalledTimes(1);
```

**localStorage Mocking:**

```typescript
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal("localStorage", mockStorage);
```

**Date Mocking:**

```typescript
vi.setSystemTime(new Date("2025-01-15"));
// ... test time-dependent behavior
vi.useRealTimers();
```

#### 4. Test Data Builders

**Create reusable test fixtures:**

```typescript
const createMockFriend = (overrides = {}) => ({
  id: "friend1",
  name: "Alice",
  email: "alice@example.com",
  ...overrides,
});

const createMockTransaction = (overrides = {}) => ({
  id: "tx1",
  date: "2025-01-15",
  description: "Test",
  amount: 4200,
  category: "Food",
  ...overrides,
});
```

#### 5. Debounced Input Testing

**Wait for debounced callbacks:**

```typescript
const user = userEvent.setup();
await user.type(screen.getByLabelText("Search"), "query");

// Wait for debounce to complete
await waitFor(
  () => {
    expect(mockOnChange).toHaveBeenCalledWith("query");
  },
  { timeout: 1000 }
);
```

### Coverage Targets & Current Status

**Overall Coverage (as of 2025-11-12):**

- Statements: 47.34% (4144/8753)
- Branches: 69.71% (1006/1443)
- Functions: 70.83% (204/288)
- Lines: 47.11% (4121/8747)

**Per-Directory Targets:**

| Directory         | Current | Target | Status   |
| ----------------- | ------- | ------ | -------- |
| `src/utils/`      | ~90%    | 90%+   | ✅ Met   |
| `src/state/`      | ~85%    | 85%+   | ✅ Met   |
| `src/lib/`        | ~75%    | 80%+   | ⚠️ Close |
| `src/hooks/`      | ~70%    | 75%+   | ⚠️ Close |
| `src/components/` | 38.59%  | 50%+   | ❌ Gap   |

**Priority Areas for Coverage Improvement:**

1. **Components:** Focus on form components (Modal, EditTransactionModal, AddFriendModal)
2. **Analytics UI:** Zero-coverage presentation components (AnalyticsDashboard, Analytics\*Chart)
3. **Balances:** Transaction list and balance display components
4. **Edge Cases:** Error states, empty states, validation failures

### Test Suite Health

**Current Test Stats:**

- Total test files: 25
- Total tests: 348 passing
- Skipped tests: 12
- Average runtime: ~3-5 seconds (full suite)

**Quality Metrics:**

- Zero flaky tests
- All async operations properly awaited
- No warnings from React Testing Library
- All mocks properly cleaned up in `afterEach`

### Known Testing Limitations

1. **Modal Focus Trapping:** `jsdom` doesn't fully simulate focus behavior; some focus management tests rely on implementation details.

2. **CSS Modules:** Class name matching uses string inclusion (`.includes()`) rather than exact matches due to hash suffixes.

3. **Debounced Inputs:** Date range filters require explicit `waitFor` with extended timeout (1000ms) to handle 500ms debounce.

4. **localStorage Quota:** No tests for quota exceeded scenarios (complex to simulate reliably).

5. **Time Zone Handling:** Tests use UTC dates; real-world time zone edge cases not fully covered.

6. **Animation/Transitions:** No tests for CSS transitions or animation completion (not observable in jsdom).

### Testing Requirements by Feature Type

**Must have tests for:**

- ✅ Analytics utilities (`src/utils/*.ts`) - 43 test cases, 100% coverage
- ✅ State store logic (`src/state/*.ts`) - Comprehensive store tests
- ✅ Core utilities (`src/lib/*.ts`) - Money, compute, selectors all tested
- ✅ React hooks (`src/hooks/*.ts`) - useFriends, useSettleUp, useTransactionFilters covered
- ⚠️ Form components - SplitForm, AddFriendModal, EditTransactionModal partially covered
- ⚠️ List components - TransactionList covered, FriendList needs tests
- ❌ Analytics UI - Presentation components not yet tested

**Coverage exemptions (acceptable to skip):**

- Pure presentation components with no logic (simple wrappers)
- Error boundary fallback UI (hard to test, low risk)
- Development-only code (console warnings, debug helpers)

### Testing Principles

1. **Test Behavior, Not Implementation**

   - Assert on visible output and user interactions
   - Avoid testing internal state or private methods
   - Use accessible queries (`getByRole`) over implementation details

2. **Arrange-Act-Assert Pattern**

   ```typescript
   it("calculates total correctly", () => {
     // Arrange
     const transactions = [createMockTransaction({ amount: 1000 })];

     // Act
     const total = calculateTotal(transactions);

     // Assert
     expect(total).toBe(1000);
   });
   ```

3. **One Assertion Per Concept**

   - Test one behavior per test case
   - Split complex scenarios into multiple focused tests
   - Makes failures easier to diagnose

4. **Descriptive Test Names**

   - Format: `should [expected behavior] when [condition]`
   - Examples:
     - ✅ `should show error when submitting with invalid amount`
     - ❌ `test submit` (too vague)

5. **Test Edge Cases & Error Paths**

   - Empty states (no data, no friends, no transactions)
   - Invalid inputs (negative amounts, missing required fields)
   - Boundary conditions (zero, maximum values, special dates)
   - Error recovery (API failures, localStorage quota)

6. **Mock External Dependencies**

   - Mock `localStorage` for persistence tests
   - Mock date/time for time-dependent tests
   - Mock callbacks to verify interactions

7. **Clean Up After Tests**
   ```typescript
   afterEach(() => {
     vi.clearAllMocks(); // Clear mock call history
     vi.useRealTimers(); // Restore real timers if mocked
     cleanup(); // Unmount components (automatic)
   });
   ```

### Regression Testing Strategy

**When fixing bugs:**

1. Write a failing test that reproduces the bug
2. Fix the implementation
3. Verify the test now passes
4. Keep the test to prevent regression

**Example workflow:**

```typescript
// Bug: SplitForm allows submission without participants
it("should show error when submitting without participants", async () => {
  const mockOnSplit = vi.fn();
  render(<SplitForm friends={mockFriends} onSplit={mockOnSplit} />);

  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Bill amount"), "100");
  await user.click(screen.getByRole("button", { name: "Save split" }));

  // Assert error is shown
  expect(
    screen.getByText("Add at least one friend to split the bill.")
  ).toBeInTheDocument();
  // Assert callback not invoked
  expect(mockOnSplit).not.toHaveBeenCalled();
});
```

### Performance Testing Guidelines

**When to add performance tests:**

- Large list rendering (>100 items)
- Complex calculations (analytics aggregations)
- Expensive memoization logic

**Example pattern:**

```typescript
it("renders 1000 transactions efficiently", () => {
  const manyTransactions = Array.from({ length: 1000 }, (_, i) =>
    createMockTransaction({ id: `tx${i}` })
  );

  const start = performance.now();
  render(<TransactionList transactions={manyTransactions} />);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(1000); // Should render in <1s
});
```

### Accessibility Testing

**Required checks for interactive components:**

- Keyboard navigation (Tab, Enter, Escape)
- Screen reader labels (aria-label, aria-describedby)
- Focus management (modals trap focus, forms focus first field)
- Error announcements (aria-live regions)

**Example pattern:**

```typescript
it("supports keyboard navigation", async () => {
  render(
    <Modal isOpen onClose={mockClose} title="Test">
      Content
    </Modal>
  );

  const user = userEvent.setup();

  // Tab to first focusable element
  await user.tab();
  expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();

  // Escape closes modal
  await user.keyboard("{Escape}");
  expect(mockClose).toHaveBeenCalled();
});
```

### Integration with CI/CD

**Pre-commit checks (recommended):**

```bash
npm run lint && npm test -- --coverage
```

**CI pipeline steps:**

1. `npm ci` - Install exact dependencies from package-lock.json
2. `npm run lint` - Fail on any ESLint warnings
3. `npm test -- --coverage` - Run tests with coverage
4. `npm run build` - Verify production build succeeds
5. Coverage threshold enforcement (optional):
   ```javascript
   coverage: {
     thresholds: {
       statements: 45,
       branches: 65,
       functions: 70,
       lines: 45,
     }
   }
   ```

### Testing Roadmap

**Phase 1: Stability (✅ COMPLETE)**

- ✅ Set up Vitest infrastructure
- ✅ Add coverage for core utilities
- ✅ Fix all failing tests
- ✅ Enable coverage persistence (reportOnFailure: true)

**Phase 2: Foundation (✅ COMPLETE)**

- ✅ Test React hooks (useFriends, useSettleUp, useTransactionFilters)
- ✅ Test form components (SplitForm, AddFriendModal, TransactionList)
- ✅ Achieve 70%+ function/branch coverage

**Phase 3: Coverage Expansion (🚧 IN PROGRESS)**

- [ ] Test remaining form components (EditTransactionModal, BudgetManager)
- [ ] Test analytics presentation components (AnalyticsCard, AnalyticsDashboard)
- [ ] Test list components (FriendList, Balances)
- [ ] Target: 50%+ component statement coverage

**Phase 4: Edge Cases & Polish (📋 PLANNED)**

- [ ] Add error boundary tests
- [ ] Add localStorage quota tests
- [ ] Add time zone edge case tests
- [ ] Add performance regression tests
- [ ] Target: 80%+ overall coverage

### Before Opening Pull Requests

**Required checks:**

- ✅ `npm run lint` passes (0 warnings, 0 errors)
- ✅ `npm test` passes (all tests green)
- ✅ `npm run build` succeeds
- ✅ Coverage doesn't decrease (compare with `main` branch)

**Recommended checks:**

- Add tests for new features or bug fixes
- Update test snapshots if intentional UI changes
- Review coverage report (`coverage/index.html`) for new code
- Manual QA: test in browser with real data
- Check for console errors/warnings during manual testing

**Test coverage expectations for new code:**

- New utilities: 90%+ coverage required
- New components: 50%+ coverage required
- Bug fixes: Must include regression test

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

## TypeScript Conventions

### JSX→TSX Migration Patterns

**Established patterns for component migrations:**

1. **Interface Definitions**

   - Define props interface above component: `interface ComponentNameProps { ... }`
   - Use `?` for optional props, avoid `| undefined` redundancy
   - Import types from `src/types/`: `LegacyFriend`, `StoredTransaction`, etc.

2. **Event Handler Typing**

   ```typescript
   // Form events
   const handleSubmit = (e: FormEvent<HTMLFormElement>) => { ... };

   // Input changes
   const handleChange = (e: ChangeEvent<HTMLInputElement>) => { ... };

   // Keyboard events
   const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => { ... };

   // Mouse events
   const handleClick = (e: MouseEvent<HTMLButtonElement>) => { ... };
   ```

3. **Ref Object Typing**

   ```typescript
   // Allow null in ref types
   const inputRef = useRef<HTMLInputElement>(null);

   // Render props with refs
   children: ReactNode |
     ((props: { firstFieldRef: RefObject<HTMLInputElement | null> }) =>
       ReactNode);
   ```

4. **Safe Type Conversions**

   ```typescript
   // Check for objects before String() conversion
   if (value === null || value === undefined || typeof value === "object")
     return null;
   const str =
     typeof value === "string" || typeof value === "number"
       ? String(value)
       : "";
   ```

5. **Type Assertions for Library Compatibility**

   ```typescript
   // When library types don't match exactly
   const filtered = applyFilters(
     sourceTransactions as Parameters<typeof applyFilters>[0]
   );
   ```

6. **Optional Callback Props**

   ```typescript
   // Use `?` and pass undefined explicitly if needed
   interface Props {
     onConfirm?: (id: string) => void;
   }

   <Component onConfirm={onConfirm ?? undefined} />;
   ```

7. **Union Types with Literals**

   ```typescript
   // Use `as const` for strict literal types
   const OPTIONS = [
     { value: "monthly", label: "Monthly" },
     { value: "weekly", label: "Weekly" },
   ] as const;

   type FrequencyValue = (typeof OPTIONS)[number]["value"];
   ```

### Migration Checklist

- [ ] Create `ComponentName.tsx` with interface definitions
- [ ] Type all event handlers (`FormEvent`, `ChangeEvent`, etc.)
- [ ] Type all refs with proper generic parameters
- [ ] Add safe type conversions for `unknown` inputs
- [ ] Remove PropTypes imports and definitions
- [ ] Delete legacy `.jsx` file
- [ ] Run `npm run lint` (0 errors required)
- [ ] Run `npm test` (all tests passing)
- [ ] Run `npm run build` (successful build)

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
- **YYYY-MM-DD:** 2025-11-12 (JSX→TSX Phase 2 completed)
