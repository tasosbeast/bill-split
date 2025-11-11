import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { StoredTransaction } from "../../types/legacySnapshot";

const storageMock = vi.hoisted(() => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
  clearState: vi.fn(),
}));

const upgradeTransactionsMock = vi.hoisted(() =>
  vi.fn((list: StoredTransaction[] = []) => [...list])
);

vi.mock("../../lib/storage", () => storageMock);

vi.mock("../../lib/transactions", () => ({
  upgradeTransactions: upgradeTransactionsMock,
}));

const { useLegacySnapshot } = await import("../useLegacySnapshot");
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
    rerender: () => {
      act(() => {
        root.render(<TestComponent />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useLegacySnapshot", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().reset();
    storageMock.loadState.mockReturnValue(null);
    upgradeTransactionsMock.mockImplementation(
      (list: StoredTransaction[] = []) => [...list]
    );
  });

  it("seeds default friends when no snapshot is stored", () => {
    const { result, unmount } = renderHook(() => useLegacySnapshot());

    expect(storageMock.loadState).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot.friends).toHaveLength(2);
    expect(result.current.snapshot.selectedId).toBeNull();
    expect(result.current.snapshot.transactions).toEqual([]);
    expect(storageMock.saveState).toHaveBeenCalledWith(
      result.current.snapshot
    );

    unmount();
  });

  it("normalizes persisted selectedId to null when friend is missing", () => {
    storageMock.loadState.mockReturnValueOnce({
      friends: [{ id: "friend-1", name: "Alex" }],
      selectedId: "missing",
      transactions: [],
    });

    const { result, unmount } = renderHook(() => useLegacySnapshot());

    expect(result.current.snapshot.selectedId).toBeNull();
    expect(storageMock.saveState).toHaveBeenCalledWith(
      result.current.snapshot
    );

    unmount();
  });

  it("drops selectedId when the selected friend is removed", () => {
    storageMock.loadState.mockReturnValueOnce({
      friends: [
        { id: "friend-1", name: "Alex" },
        { id: "friend-2", name: "Maria" },
      ],
      selectedId: "friend-1",
      transactions: [],
    });

    const { result, unmount } = renderHook(() => useLegacySnapshot());

    act(() => {
      result.current.updaters.setFriends((prev) =>
        prev.filter((friend) => friend.id !== "friend-1")
      );
    });

    expect(result.current.snapshot.friends).toHaveLength(1);
    expect(result.current.snapshot.selectedId).toBeNull();
    expect(storageMock.saveState).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("applies upgradeTransactions whenever transactions change", () => {
    const upgraded = [{ id: "tx-1" } as StoredTransaction];

    upgradeTransactionsMock.mockImplementation(() => upgraded);

    const { result, unmount } = renderHook(() => useLegacySnapshot());

    act(() => {
      result.current.updaters.setTransactions([
        { id: "tx-1" } as StoredTransaction,
      ]);
    });

    expect(upgradeTransactionsMock).toHaveBeenCalledWith([
      { id: "tx-1" },
    ]);
    expect(result.current.snapshot.transactions).toBe(upgraded);

    unmount();
  });

  it("resets snapshot and clears storage", () => {
    const { result, unmount } = renderHook(() => useLegacySnapshot());

    act(() => {
      result.current.updaters.reset();
    });

    expect(storageMock.clearState).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot.friends).toHaveLength(2);
    expect(result.current.snapshot.transactions).toEqual([]);

    unmount();
  });
});
