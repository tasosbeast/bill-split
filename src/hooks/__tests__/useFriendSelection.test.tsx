import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LegacyFriend, UISnapshot } from "../../types/legacySnapshot";
import type { UseLegacySnapshotResult } from "../useLegacySnapshot";
import type { UseFriendSelectionResult } from "../useFriendSelection";

const computeBalancesMock = vi.fn<
  (...args: unknown[]) => Map<string, number>
>();
const useLegacySnapshotMock = vi.fn<() => UseLegacySnapshotResult>();

vi.mock(
  "../useLegacySnapshot",
  () =>
    ({
      useLegacySnapshot: useLegacySnapshotMock,
    }) satisfies { useLegacySnapshot: () => UseLegacySnapshotResult }
);

vi.mock(
  "../../lib/compute",
  () =>
    ({
      computeBalances: computeBalancesMock,
    }) satisfies { computeBalances: () => Map<string, number> }
);

const { useFriendSelection } = await import("../useFriendSelection");

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

const baseSnapshot: UISnapshot = {
  friends: [{ id: "friend-1", name: "Alex", email: "alex@example.com" }],
  selectedId: null,
  transactions: [],
};

const createUpdaters = () => {
  const setFriends = vi.fn<
    UseLegacySnapshotResult["updaters"]["setFriends"]
  >();
  const setSelectedId = vi.fn<
    UseLegacySnapshotResult["updaters"]["setSelectedId"]
  >();
  const setTransactions = vi.fn<
    UseLegacySnapshotResult["updaters"]["setTransactions"]
  >();
  const replaceSnapshot = vi.fn<
    UseLegacySnapshotResult["updaters"]["replaceSnapshot"]
  >();
  const reset = vi.fn<UseLegacySnapshotResult["updaters"]["reset"]>();

  return {
    updaters: {
      setFriends,
      setSelectedId,
      setTransactions,
      replaceSnapshot,
      reset,
    } as UseLegacySnapshotResult["updaters"],
    mocks: {
      setFriends,
      setSelectedId,
      setTransactions,
      replaceSnapshot,
      reset,
    },
  };
};

describe("useFriendSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLegacySnapshotMock.mockReset();
    computeBalancesMock.mockReset();
    computeBalancesMock.mockReturnValue(new Map<string, number>());
  });

  it("appends a friend and selects it when createFriend succeeds", () => {
    const { updaters, mocks } = createUpdaters();
    useLegacySnapshotMock.mockReturnValue({
      snapshot: baseSnapshot,
      updaters,
    });

    const { result, unmount } = renderHook(() => useFriendSelection());

    const newFriend: LegacyFriend = {
      id: "friend-2",
      name: "Maria",
      email: "maria@example.com",
    };

    let outcome: ReturnType<UseFriendSelectionResult["createFriend"]>;
    act(() => {
      outcome = result.current.createFriend(newFriend);
    });

    const outcomeValue = outcome!;
    expect(outcomeValue).toEqual({ ok: true });
    expect(mocks.setFriends).toHaveBeenCalledTimes(1);
    const updater = mocks.setFriends.mock.calls[0][0] as (
      prev: LegacyFriend[]
    ) => LegacyFriend[];
    const updatedFriends = updater(baseSnapshot.friends);
    expect(updatedFriends).toHaveLength(2);
    expect(updatedFriends).toContainEqual(newFriend);
    expect(mocks.setSelectedId).toHaveBeenCalledWith("friend-2");

    unmount();
  });

  it("guards against duplicate friend emails", () => {
    const { updaters, mocks } = createUpdaters();
    useLegacySnapshotMock.mockReturnValue({
      snapshot: baseSnapshot,
      updaters,
    });

    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => undefined);

    const { result, unmount } = renderHook(() => useFriendSelection());

    act(() => {
      const outcome = result.current.createFriend({
        id: "friend-3",
        name: "Alex Clone",
        email: "alex@example.com",
      });
      expect(outcome).toEqual({ ok: false, reason: "duplicate-email" });
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "A friend with this email already exists."
    );
    expect(mocks.setFriends).not.toHaveBeenCalled();
    expect(mocks.setSelectedId).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    unmount();
  });

  it("derives selectedFriend and balance from snapshot state", () => {
    const { updaters } = createUpdaters();
    const snapshot: UISnapshot = {
      friends: [
        { id: "friend-1", name: "Alex", email: "alex@example.com" },
        { id: "friend-2", name: "Maria", email: "maria@example.com" },
      ],
      selectedId: "friend-2",
      transactions: [{ id: "tx-1" }] as unknown as UISnapshot["transactions"],
    };
    useLegacySnapshotMock.mockReturnValue({
      snapshot,
      updaters,
    });
    computeBalancesMock.mockReturnValue(
      new Map<string, number>([
        ["friend-2", 42],
        ["friend-1", -15],
      ])
    );

    const { result, unmount } = renderHook(() => useFriendSelection());

    expect(result.current.selectedFriend).toEqual(snapshot.friends[1]);
    expect(result.current.selectedBalance).toBe(42);
    expect(result.current.balances.get("friend-1")).toBe(-15);

    unmount();
  });

  it("alerts when settle is attempted without a selected friend", () => {
    const { updaters } = createUpdaters();
    useLegacySnapshotMock.mockReturnValue({
      snapshot: baseSnapshot,
      updaters,
    });

    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => undefined);

    const { result, unmount } = renderHook(() => useFriendSelection());

    let outcome: ReturnType<UseFriendSelectionResult["ensureSettle"]>;
    act(() => {
      outcome = result.current.ensureSettle();
    });

    const outcomeValue = outcome!;
    expect(outcomeValue).toEqual({ allowed: false, reason: "no-selection" });
    expect(alertSpy).toHaveBeenCalledWith(
      "Select a friend before settling the balance."
    );

    alertSpy.mockRestore();
    unmount();
  });

  it("alerts when selected friend is already settled", () => {
    const { updaters } = createUpdaters();
    const snapshot: UISnapshot = {
      ...baseSnapshot,
      selectedId: "friend-1",
    };
    useLegacySnapshotMock.mockReturnValue({
      snapshot,
      updaters,
    });
    computeBalancesMock.mockReturnValue(new Map<string, number>([["friend-1", 0]]));

    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => undefined);

    const { result, unmount } = renderHook(() => useFriendSelection());

    let outcome: ReturnType<UseFriendSelectionResult["ensureSettle"]>;
    act(() => {
      outcome = result.current.ensureSettle();
    });

    const outcomeValue = outcome!;
    expect(outcomeValue).toEqual({ allowed: false, reason: "no-balance" });
    expect(alertSpy).toHaveBeenCalledWith(
      "This friend is already settled."
    );

    alertSpy.mockRestore();
    unmount();
  });

  it("allows settlement when a balance exists", () => {
    const { updaters } = createUpdaters();
    const snapshot: UISnapshot = {
      ...baseSnapshot,
      selectedId: "friend-1",
    };
    useLegacySnapshotMock.mockReturnValue({
      snapshot,
      updaters,
    });
    computeBalancesMock.mockReturnValue(
      new Map<string, number>([["friend-1", -25]])
    );

    const { result, unmount } = renderHook(() => useFriendSelection());

    let outcome: ReturnType<UseFriendSelectionResult["ensureSettle"]>;
    act(() => {
      outcome = result.current.ensureSettle();
    });

    const outcomeValue = outcome!;
    expect(outcomeValue).toEqual({
      allowed: true,
      friendId: "friend-1",
      balance: -25,
    });

    unmount();
  });
});
