# Agents

This document tracks the automated “agents” that power the Bill Split experience.
In this codebase an **agent** is a deliberate bundle of logic that owns an
automation loop: it takes well-defined inputs, performs a focused computation or
side effect, and exposes a stable contract to the rest of the app. Capturing
these responsibilities here helps keep analytical features composable as the
project grows.

## System Map

| Agent | Responsibility | Main Implementation | Inputs | Outputs | Status |
| --- | --- | --- | --- | --- | --- |
| **Transactions Agent** | Ingest, sanitize, persist the canonical list of transactions and budgets. | `src/state/transactionsStore.ts` | Raw persisted payloads, UI mutations | In-memory store + persistence layer events | ✅ Active |
| **Analytics Agent** | Derive spend totals, trends, and budget deltas for dashboards. | `src/utils/analytics.ts`, `src/lib/analytics.js` | Sanitized transactions, budgets | Aggregated metrics (category totals, monthly buckets, budget comparisons) | ✅ Active |
| **Balances Agent** | Track who owes whom and surface top balances. | `src/lib/analytics.js` (`computeFriendBalances`) | Transaction effects | Sorted friend balance list | ✅ Active |
| **Budget Agent** | Manage category-level budgets and utilization figures. | `src/state/transactionsStore.ts`, `src/utils/analytics.ts` (`compareBudgetByCategory`) | Budget settings, spend totals | Budget aggregates, remaining allowances | ✅ Active |
| **UI Orchestrator** | Compose agent outputs into user-facing analytics. | `src/pages/AnalyticsDashboard.tsx`, `src/components/Analytics*` | Agent outputs via selectors/hooks | Dashboard cards, charts, lists | ✅ Active |

> _Status Legend_: ✅ Active (implemented), 🧭 Planned (design agreed, implementation pending), 🛠️ In Progress (currently being built).

## Data Flow

```
Persistence ➜ Transactions Agent ➜ Analytics/Budget/Balances Agents ➜ UI Orchestrator
```

1. **Persistence** (`src/state/persistence.ts`) loads the serialized snapshot.
2. **Transactions Agent** normalizes categories, participants, and totals, then
   emits a clean `TransactionsState`.
3. Specialized agents consume that state to compute domain-specific insights:
   - Analytics Agent: totals, monthly spend, trend data (`monthlySpendPerCategory`, `totalSpendPerCategory`, `computeMonthlyTrend`).
   - Budget Agent: category targets and utilization (`selectBudgetAggregates`, `compareBudgetByCategory`).
   - Balances Agent: friend deltas for settlement views (`computeFriendBalances`).
4. **UI Orchestrator** pulls from `src/lib/selectors.js` and renders React components.

## Contracts & Testing

- **Input contracts**: All agents expect sanitized transactions. When adding new
  fields to the persisted model, update `sanitizeTransaction` and related helpers
  in `src/state/transactionsStore.ts`.
- **Output stability**: Functions exported from `src/utils/analytics.ts` and
  `src/lib/analytics.js` should stay pure and deterministic. Guard them with
  Vitest suites (`src/utils/__tests__/analytics.test.ts`) before shipping.
- **Selectors**: Any new agent output exposed to React should go through a
  selector or hook to keep the components decoupled from implementation details.

## Adding a New Agent

1. **Define the loop**: Document the responsibility, inputs, and desired
   outputs. Validate that no existing agent already owns the work.
2. **Implement in isolation**: Favor pure utilities (mirroring
   `src/utils/analytics.ts`) or a dedicated module under `src/state/` when state
   is required. Keep dependencies minimal.
3. **Expose via selector**: Add a selector/hook that returns a stable shape for
   React or other consumers.
4. **Test and document**: Provide Vitest coverage and update this table with the
   new agent’s name, scope, and status.

## Open Questions / Future Agents

- Should import or reconciliation flows (e.g., bank CSV ingestion) live under a
  dedicated **Import Agent**?
- Do we need a **Notification Agent** to highlight anomalies or overdue
  settlements?
- How should streaming or real-time collaboration be represented if it lands on
  the roadmap?

Log design decisions here as they are made so new contributors understand which
capabilities exist and where to extend the system.

