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

vi.mock("../../lib/transactions", () => ({
  getTransactionEffects: getTransactionEffectsMock,
  transactionIncludesFriend: transactionIncludesFriendMock,
}));

const { useLegacyTransactions } = await import("../useLegacyTransactions");

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
    { id: "friend-1", name: "Alex" },
    { id: "friend-2", name: "Maria" },
  ],
  selectedId: "friend-1",
  transactions: baseTransactions,
};

describe("useLegacyTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTransactionEffectsMock.mockReturnValue([]);
    transactionIncludesFriendMock.mockImplementation((transaction, friendId) =>
      (transaction.friendIds || []).includes(friendId)
    );
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "generated-id"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes transactions and default filter", () => {
    let store = snapshot.transactions;
    const setTransactions = vi.fn(
      (
        updater:
          | StoredTransaction[]
          | ((previous: StoredTransaction[]) => StoredTransaction[])
      ) => {
        store = typeof updater === "function" ? updater(store) : updater;
      }
    );

    const { result, unmount } = renderHook(() =>
      useLegacyTransactions({
        transactions: store,
        selectedFriendId: snapshot.selectedId,
        setTransactions,
      })
    );

    expect(result.current.state.transactions).toEqual(store);
    expect(result.current.state.filter).toBe("All");
    expect(result.current.state.transactionsByFilter).toHaveLength(2);

    unmount();
  });

  it("updates the filter and clears it", () => {
    const setTransactions = vi.fn();
    const { result, rerender, unmount } = renderHook(() =>
      useLegacyTransactions({
        transactions: snapshot.transactions,
        selectedFriendId: snapshot.selectedId,
        setTransactions,
      })
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

    const { result, unmount } = renderHook(() =>
      useLegacyTransactions({
        transactions: snapshot.transactions,
        selectedFriendId: "friend-1",
        setTransactions: vi.fn(),
      })
    );

    expect(result.current.state.transactionsForSelectedFriend).toHaveLength(1);
    expect(result.current.state.transactionsForSelectedFriend[0].effect).toEqual(
      effects[0]
    );

    unmount();
  });

  it("adds, updates, and removes transactions", () => {
    let store = [...snapshot.transactions];
    const setTransactions = vi.fn(
      (
        updater:
          | StoredTransaction[]
          | ((previous: StoredTransaction[]) => StoredTransaction[])
      ) => {
        store = typeof updater === "function" ? updater(store) : updater;
      }
    );

    const { result, unmount } = renderHook(() =>
      useLegacyTransactions({
        transactions: store,
        selectedFriendId: snapshot.selectedId,
        setTransactions,
      })
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
    expect(store[0]).toEqual(newTransaction);

    const updated = { ...newTransaction, total: 60 } as StoredTransaction;
    act(() => {
      result.current.handlers.updateTransaction(updated);
    });
    expect(store[0]).toEqual(updated);

    act(() => {
      result.current.handlers.removeTransaction(updated.id);
    });
    expect(store.find((tx) => tx.id === updated.id)).toBeUndefined();

    unmount();
  });

  it("creates a settlement transaction", () => {
    let store = [...snapshot.transactions];
    const setTransactions = vi.fn(
      (
        updater:
          | StoredTransaction[]
          | ((previous: StoredTransaction[]) => StoredTransaction[])
      ) => {
        store = typeof updater === "function" ? updater(store) : updater;
      }
    );

    const { result, unmount } = renderHook(() =>
      useLegacyTransactions({
        transactions: store,
        selectedFriendId: "friend-1",
        setTransactions,
      })
    );

    act(() => {
      result.current.handlers.addSettlement("friend-1", 15);
    });

    const settlement = store[0];
    expect(settlement.type).toBe("settlement");
    expect(settlement.friendId).toBe("friend-1");
    expect(settlement.effects?.[0]?.delta).toBe(-15);

    unmount();
  });
});
