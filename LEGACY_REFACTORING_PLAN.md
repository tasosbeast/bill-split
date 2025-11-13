# Legacy Code Refactoring Plan

**Date:** November 13, 2025  
**Goal:** Remove confusing "legacy" naming conventions and reorganize code structure

---

## Current State Analysis

### Misnomers Identified

The term "legacy" is used throughout the codebase, but it's misleading:

1. **`LegacyFriend`** - Just an alias for `Friend` type (not legacy at all)
2. **`src/features/legacyApp/LegacyAppShell.tsx`** - The **active** application shell (not legacy)
3. **`src/components/legacy/`** - Contains **active** panel components (not legacy)
4. **`useLegacySnapshot`, `useLegacyFriendManagement`, `useLegacyTransactions`** - All **active** hooks (not legacy)

### Actual Structure

```
src/
├── features/
│   └── legacyApp/           ← RENAME: This is the current app shell
│       └── LegacyAppShell.tsx
├── components/
│   ├── legacy/              ← RENAME: These are active panels
│   │   ├── AnalyticsPanel.tsx
│   │   ├── FriendsPanel.tsx
│   │   ├── RestoreSnapshotModal.tsx
│   │   └── TransactionsPanel.tsx
│   └── [other components]
├── hooks/
│   ├── useLegacySnapshot.ts          ← RENAME
│   ├── useLegacyFriendManagement.ts  ← RENAME
│   └── useLegacyTransactions.ts      ← RENAME
└── types/
    └── legacySnapshot.ts    ← RENAME: Contains active types
```

---

## Refactoring Strategy

### Phase 1: Type Aliases (Safest)

**Remove unnecessary type aliases without changing functionality**

1. Replace `LegacyFriend` with `Friend` throughout codebase
2. Update all imports and type annotations
3. Remove the alias from `legacySnapshot.ts`

**Files affected:** ~20 files
**Risk:** Low (simple find-replace)
**Testing:** Existing tests should pass

---

### Phase 2: Rename Files & Folders

**Reorganize folder structure and rename files**

#### 2a. Rename `src/features/legacyApp/` → `src/features/app/`

```
src/features/legacyApp/LegacyAppShell.tsx
  → src/features/app/AppShell.tsx
```

#### 2b. Move `src/components/legacy/` panels to top-level components

**Option A (Flat):** Move to `src/components/`

```
src/components/legacy/AnalyticsPanel.tsx
  → src/components/AnalyticsPanel.tsx
```

**Option B (Panels folder):** Create `src/components/panels/`

```
src/components/legacy/AnalyticsPanel.tsx
  → src/components/panels/AnalyticsPanel.tsx
```

**Recommendation:** Option A (Flat) - Simpler, fewer folders, already have Balances.jsx and Transactions.jsx at top level

**Files affected:**

- `AnalyticsPanel.tsx`
- `FriendsPanel.tsx`
- `TransactionsPanel.tsx`
- `RestoreSnapshotModal.tsx` (consider moving to `src/components/` with other modals)

---

### Phase 3: Rename Hooks

**Remove "Legacy" prefix from hook names**

```
useLegacySnapshot.ts → useSnapshot.ts
useLegacyFriendManagement.ts → useFriendManagement.ts
useLegacyTransactions.ts → useTransactions.ts (WAIT - already exists!)
```

**⚠️ Conflict:** `useTransactions.ts` already exists!

**Resolution:** Check if `useLegacyTransactions.ts` is redundant or if we need to merge them.

**Files affected:** ~15 files importing these hooks
**Risk:** Medium (many import sites)
**Testing:** Hook tests must be updated and passing

---

### Phase 4: Rename Types File

**Rename `legacySnapshot.ts` to something more descriptive**

```
types/legacySnapshot.ts → types/snapshot.ts
```

**Alternative names:**

- `appSnapshot.ts` (describes what it is)
- `persistence.ts` (describes its purpose)
- `domain.ts` (if merging with existing domain types)

**Recommendation:** `snapshot.ts` - Clear, concise, describes the state snapshots

**Files affected:** ~30 files importing these types
**Risk:** Medium-high (many import sites)
**Testing:** All tests must pass

---

## Detailed Refactoring Steps

### Step 1: Remove `LegacyFriend` Type Alias

**Files to update:**

1. `src/types/legacySnapshot.ts`
   - Remove: `export type LegacyFriend = Friend;`
2. Replace all occurrences of `LegacyFriend` with `Friend`:
   - `src/hooks/*.ts` (5 files)
   - `src/hooks/__tests__/*.tsx` (3 test files)
   - `src/components/**/*.tsx` (10+ files)
   - `src/features/legacyApp/LegacyAppShell.tsx`

**Command to find all occurrences:**

```bash
grep -r "LegacyFriend" src/
```

**Expected changes:** ~50 occurrences across 20 files

---

### Step 2: Rename and Reorganize Folders

#### 2.1: Rename `legacyApp` → `app`

```bash
mv src/features/legacyApp src/features/app
```

**Update in:** `src/App.jsx`

```javascript
// Before
import LegacyAppShell from "./features/legacyApp/LegacyAppShell";

// After
import AppShell from "./features/app/AppShell";
```

#### 2.2: Move `legacy/` panels to top-level

```bash
mv src/components/legacy/AnalyticsPanel.tsx src/components/
mv src/components/legacy/FriendsPanel.tsx src/components/
mv src/components/legacy/TransactionsPanel.tsx src/components/
mv src/components/legacy/RestoreSnapshotModal.tsx src/components/
rmdir src/components/legacy/
```

**Update imports in:** `src/features/app/AppShell.tsx`

```typescript
// Before
import FriendsPanel from "../../components/legacy/FriendsPanel";

// After
import FriendsPanel from "../../components/FriendsPanel";
```

---

### Step 3: Rename Hooks

#### 3.1: Rename `useLegacySnapshot` → `useSnapshot`

```bash
mv src/hooks/useLegacySnapshot.ts src/hooks/useSnapshot.ts
mv src/hooks/__tests__/useLegacySnapshot.test.tsx src/hooks/__tests__/useSnapshot.test.tsx
```

**Update all imports** (~10 files)

#### 3.2: Rename `useLegacyFriendManagement` → `useFriendManagement`

```bash
mv src/hooks/useLegacyFriendManagement.ts src/hooks/useFriendManagement.ts
mv src/hooks/__tests__/useLegacyFriendManagement.test.tsx src/hooks/__tests__/useFriendManagement.test.tsx
```

**Update all imports** (~5 files)

#### 3.3: Handle `useLegacyTransactions` conflict

**Option A:** Rename to `useTransactionManagement` (more specific)
**Option B:** Merge with existing `useTransactions` if redundant
**Option C:** Keep as is if they serve different purposes

**Action Required:** Analyze both hooks to determine best approach

---

### Step 4: Rename Types File

```bash
mv src/types/legacySnapshot.ts src/types/snapshot.ts
```

**Update all imports** (~30 files)

```typescript
// Before
import type { UISnapshot } from "../types/legacySnapshot";

// After
import type { UISnapshot } from "../types/snapshot";
```

---

## Testing Strategy

### After Each Step:

1. **Run linter:** `npm run lint`
2. **Run tests:** `npm test`
3. **Build:** `npm run build`
4. **Manual testing:** Start dev server, test all features

### Regression Testing Checklist:

- [ ] Add friend
- [ ] Create split transaction
- [ ] Edit transaction
- [ ] Delete transaction
- [ ] Remove friend
- [ ] Settle balance
- [ ] View analytics
- [ ] Save/restore backup
- [ ] Switch between views
- [ ] Filter transactions

---

## Git Commit Strategy

### Commit 1: Remove LegacyFriend type alias

```
refactor: replace LegacyFriend with Friend type

- Remove unnecessary type alias from types/legacySnapshot.ts
- Update all imports to use Friend directly
- No functional changes, pure refactoring

Files changed: ~20
Tests: All passing
```

### Commit 2: Rename legacyApp folder

```
refactor: rename legacyApp → app folder structure

- Rename src/features/legacyApp to src/features/app
- Rename LegacyAppShell.tsx to AppShell.tsx
- Update import in App.jsx

Files changed: 2
Tests: All passing
```

### Commit 3: Move legacy panels to top-level

```
refactor: move panels from legacy/ to components/

- Move AnalyticsPanel, FriendsPanel, TransactionsPanel to src/components/
- Move RestoreSnapshotModal to src/components/
- Remove empty legacy/ folder
- Update all import paths

Files changed: ~10
Tests: All passing
```

### Commit 4: Rename hooks

```
refactor: remove "Legacy" prefix from hook names

- Rename useLegacySnapshot → useSnapshot
- Rename useLegacyFriendManagement → useFriendManagement
- Update all imports and test files

Files changed: ~20
Tests: All passing
```

### Commit 5: Rename types file

```
refactor: rename legacySnapshot.ts → snapshot.ts

- Rename types/legacySnapshot.ts to types/snapshot.ts
- Update all import statements
- More accurate naming for active types

Files changed: ~30
Tests: All passing
```

---

## Risk Assessment

| Step                      | Risk Level | Mitigation                                         |
| ------------------------- | ---------- | -------------------------------------------------- |
| Remove LegacyFriend alias | 🟢 Low     | Simple find-replace, TypeScript catches errors     |
| Rename legacyApp folder   | 🟢 Low     | Single import site, easy to verify                 |
| Move legacy/ panels       | 🟡 Medium  | Multiple import sites, careful path updates needed |
| Rename hooks              | 🟡 Medium  | Many import sites, potential naming conflicts      |
| Rename types file         | 🟠 High    | Most import sites, touches many files              |

**Overall risk:** 🟡 **Medium** - Mostly mechanical changes, but touches many files

---

## Rollback Plan

If issues arise:

1. **Stop immediately** after failed step
2. **Git reset** to last known good commit
3. **Review** failed changes
4. **Fix** specific issues
5. **Retry** with corrected approach

---

## Benefits

✅ **Clearer naming** - No more confusing "legacy" terminology  
✅ **Better organization** - Flatter folder structure, easier navigation  
✅ **Maintainability** - Future developers won't wonder what's "legacy"  
✅ **Consistency** - Naming matches actual code purpose  
✅ **Documentation** - AGENTS.md and comments become clearer

---

## Timeline Estimate

- **Step 1 (LegacyFriend):** 30 minutes
- **Step 2 (Folders):** 45 minutes
- **Step 3 (Hooks):** 60 minutes
- **Step 4 (Types):** 45 minutes
- **Testing & verification:** 30 minutes

**Total:** ~3.5 hours

---

## Decision Required

**Should we proceed with full refactoring or partial?**

**Option A: Full refactoring (all 5 steps)**

- Pros: Complete cleanup, no legacy naming left
- Cons: Touches ~50+ files, higher risk

**Option B: Partial refactoring (steps 1-3 only)**

- Pros: Lower risk, immediate benefit
- Cons: Still have "legacySnapshot" file

**Option C: Minimal refactoring (step 1 only)**

- Pros: Lowest risk, quick win
- Cons: Incomplete cleanup

**Recommendation:** Option A (Full refactoring) - The codebase is well-tested, changes are mechanical, and the benefits outweigh the risks.

---

**Ready to proceed?** Let's start with Step 1: Removing the `LegacyFriend` type alias.
