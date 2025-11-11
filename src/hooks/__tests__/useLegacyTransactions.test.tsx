import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredTransaction, UISnapshot } from "../../types/legacySnapshot";
import type { TransactionEffect } from "../../types/transaction";

const getTransactionEffectsMock = vi.fn<
  (transaction: StoredTransaction) => TransactionEffect[]
>();
const transactionIncludesFriendMock = vi.fn<
  (transaction: StoredTransaction, friendId: string) => boolean
>();
const upgradeTransactionsMock = vi.fn<(list: any[]) => any[]>();

vi.mock("../../lib/transactions", () => ({
  getTransactionEffects: getTransactionEffectsMock,
  transactionIncludesFriend: transactionIncludesFriendMock,
  upgradeTransactions: upgradeTransactionsMock,
}));

const { useLegacyTransactions } = await import("../useLegacyTransactions");
const { useAppStore } = await import("../../state/appStore");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function renderHook<T>(callback: () => T) {
  const result: { current: T | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    result.current = callback();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    result: result as { current: T },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    rerender: () => {
      act(() => {
        root.render(<TestComponent />);
      });
    },
  };
}

const baseTransactions: StoredTransaction[] = [
  {
    id: "tx-1",
    type: "split",
    category: "Food",
    total: 25,
    friendId: "friend-1",
    friendIds: ["friend-1"],
    participants: [],
    effects: [],
  },
  {
    id: "tx-2",
    type: "split",
    category: "Travel",
    total: 80,
    friendId: "friend-2",
    friendIds: ["friend-2"],
    participants: [],
    effects: [],
  },
];

const snapshot: UISnapshot = {
  friends: [
    { id: "friend-1", name: "Alex", active: true, createdAt: Date.now() },
    { id: "friend-2", name: "Maria", active: true, createdAt: Date.now() },
  ],
  selectedId: "friend-1",
  transactions: baseTransactions,
  templates: [],
};

describe("useLegacyTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to clean state
    useAppStore.getState().reset();
    getTransactionEffectsMock.mockReturnValue([]);
    transactionIncludesFriendMock.mockImplementation((transaction, friendId) =>
      (transaction.friendIds || []).includes(friendId)
    );
    upgradeTransactionsMock.mockImplementation((list) => list);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "generated-id"),
    });
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("exposes transactions and default filter", () => {
    // Populate store with test data
    useAppStore.getState().replaceSnapshot(snapshot);

    const { result, unmount } = renderHook(() =>
      useLegacyTransactions()
    );

    expect(result.current.state.transactions).toEqual(snapshot.transactions);
    expect(result.current.state.filter).toBe("All");
    expect(result.current.state.transactionsByFilter).toHaveLength(2);

    unmount();
  });

  it("updates the filter and clears it", () => {
    // Populate store with test data
    useAppStore.getState().replaceSnapshot(snapshot);

    const { result, rerender, unmount } = renderHook(() =>
      useLegacyTransactions()
    );

    act(() => {
      result.current.handlers.setFilter("Travel");
    });
    rerender();
    expect(result.current.state.filter).toBe("Travel");

    act(() => {
      result.current.handlers.clearFilter();
    });
    rerender();
    expect(result.current.state.filter).toBe("All");

    unmount();
  });

  it("derives transactions for the selected friend with effect details", () => {
    const effects: TransactionEffect[] = [
      { friendId: "friend-1", delta: 10, share: 10 },
    ];
    getTransactionEffectsMock.mockImplementation((transaction) =>
      transaction.id === "tx-1" ? effects : []
    );

    // Populate store with test data
    useAppStore.getState().replaceSnapshot(snapshot);

    const { result, unmount } = renderHook(() =>
      useLegacyTransactions()
    );

    expect(result.current.state.transactionsForSelectedFriend).toHaveLength(1);
    expect(result.current.state.transactionsForSelectedFriend[0].effect).toEqual(
      effects[0]
    );

    unmount();
  });

  it("adds, updates, and removes transactions", () => {
    // Populate store with test data
    useAppStore.getState().replaceSnapshot(snapshot);

    const { result, unmount, rerender } = renderHook(() =>
      useLegacyTransactions()
    );

    const newTransaction: StoredTransaction = {
      id: "tx-new",
      type: "split",
      category: "Utilities",
      total: 40,
      friendId: "friend-1",
      friendIds: ["friend-1"],
      participants: [],
      effects: [],
    };

    act(() => {
      result.current.handlers.addTransaction(newTransaction);
    });
    rerender();
    expect(result.current.state.transactions[0]).toEqual(newTransaction);

    const updated = { ...newTransaction, total: 60 } as StoredTransaction;
    act(() => {
      result.current.handlers.updateTransaction(updated);
    });
    rerender();
    expect(result.current.state.transactions[0]).toEqual(updated);

    act(() => {
      result.current.handlers.removeTransaction(updated.id);
    });
    rerender();
    expect(result.current.state.transactions.find((tx) => tx.id === updated.id)).toBeUndefined();

    unmount();
  });

  it("creates a settlement transaction with pending status metadata", () => {
    // Populate store with test data
    useAppStore.getState().replaceSnapshot(snapshot);

    const { result, unmount, rerender } = renderHook(() =>
      useLegacyTransactions()
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-05-01T12:00:00.000Z"));

    act(() => {
      result.current.handlers.addSettlement({ friendId: "friend-1", balance: 15 });
    });
    rerender();

    const settlement = result.current.state.transactions[0];
    expect(settlement.type).toBe("settlement");
    expect(settlement.friendId).toBe("friend-1");
    expect(settlement.effects?.[0]?.delta).toBe(-15);
    expect(settlement.settlementStatus).toBe("initiated");
    expect(settlement.settlementInitiatedAt).toBe("2024-05-01T12:00:00.000Z");
    expect(settlement.settlementConfirmedAt).toBeNull();
    expect(settlement.payment).toBeNull();
    expect(settlement.updatedAt).toBe("2024-05-01T12:00:00.000Z");

    vi.useRealTimers();
    unmount();
  });

  it("supports confirming, cancelling, and reopening settlements", () => {
    // Populate store with test data
    useAppStore.getState().replaceSnapshot(snapshot);

    const { result, unmount, rerender } = renderHook(() =>
      useLegacyTransactions()
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-05-01T08:00:00.000Z"));
    act(() => {
      result.current.handlers.addSettlement({ friendId: "friend-1", balance: 20 });
    });
    rerender();
    const pending = result.current.state.transactions[0];
    expect(pending.settlementStatus).toBe("initiated");

    vi.setSystemTime(new Date("2024-05-02T09:30:00.000Z"));
    act(() => {
      result.current.handlers.confirmSettlement(pending.id);
    });
    rerender();

    const confirmed = result.current.state.transactions.find((tx) => tx.id === pending.id)!;
    expect(confirmed.settlementStatus).toBe("confirmed");
    expect(confirmed.settlementConfirmedAt).toBe("2024-05-02T09:30:00.000Z");
    expect(confirmed.settlementInitiatedAt).toBe("2024-05-01T08:00:00.000Z");
    expect(confirmed.updatedAt).toBe("2024-05-02T09:30:00.000Z");

    vi.setSystemTime(new Date("2024-05-03T10:00:00.000Z"));
    act(() => {
      result.current.handlers.cancelSettlement(pending.id);
    });
    rerender();

    const cancelled = result.current.state.transactions.find((tx) => tx.id === pending.id)!;
    expect(cancelled.settlementStatus).toBe("cancelled");
    expect(cancelled.settlementCancelledAt).toBe("2024-05-03T10:00:00.000Z");
    expect(cancelled.settlementConfirmedAt).toBeNull();

    vi.setSystemTime(new Date("2024-05-04T11:15:00.000Z"));
    act(() => {
      result.current.handlers.reopenSettlement(pending.id);
    });
    rerender();

    const reopened = result.current.state.transactions.find((tx) => tx.id === pending.id)!;
    expect(reopened.settlementStatus).toBe("initiated");
    expect(reopened.settlementCancelledAt).toBeNull();
    expect(reopened.settlementConfirmedAt).toBeNull();
    expect(reopened.updatedAt).toBe("2024-05-04T11:15:00.000Z");

    vi.useRealTimers();

    unmount();
  });
});
