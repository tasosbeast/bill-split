import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LegacyFriend, StoredTransaction } from "../../types/legacySnapshot";

const createFriendMock = vi.fn<
  (friend: LegacyFriend) => { ok: boolean; reason?: string }
>();
const ensureSettleMock = vi.fn();

const baseSelection = {
  snapshot: {
    friends: [] as LegacyFriend[],
    selectedId: null,
    transactions: [] as StoredTransaction[],
  },
  updaters: {
    setFriends: vi.fn(),
    setSelectedId: vi.fn(),
    setTransactions: vi.fn(),
    replaceSnapshot: vi.fn(),
    reset: vi.fn(),
  },
  friends: [] as LegacyFriend[],
  selectedId: null as string | null,
  selectedFriend: null as LegacyFriend | null,
  friendsById: new Map<string, LegacyFriend>(),
  balances: new Map<string, number>(),
  selectedBalance: 0,
  createFriend: createFriendMock,
  selectFriend: vi.fn(),
  ensureSettle: ensureSettleMock,
} as const;

vi.mock("../useFriendSelection", () => ({
  useFriendSelection: () => baseSelection,
}));

const { useLegacyFriendManagement } = await import("../useLegacyFriendManagement");

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
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useLegacyFriendManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles add friend modal state", () => {
    const { result, unmount } = renderHook(() => useLegacyFriendManagement());

    expect(result.current.showAddModal).toBe(false);

    act(() => {
      result.current.openAddModal();
    });
    expect(result.current.showAddModal).toBe(true);

    act(() => {
      result.current.closeAddModal();
    });
    expect(result.current.showAddModal).toBe(false);

    unmount();
  });

  it("invokes createFriend and closes modal on success", () => {
    createFriendMock.mockReturnValueOnce({ ok: true });
    const { result, unmount } = renderHook(() => useLegacyFriendManagement());

    act(() => {
      result.current.openAddModal();
    });

    const friend: LegacyFriend = { id: "friend-1", name: "Alex" };

    act(() => {
      result.current.createFriend(friend);
    });

    expect(createFriendMock).toHaveBeenCalledWith(friend);
    expect(result.current.showAddModal).toBe(false);

    unmount();
  });

  it("keeps modal open when creation fails", () => {
    createFriendMock.mockReturnValueOnce({ ok: false, reason: "duplicate-email" });
    const { result, unmount } = renderHook(() => useLegacyFriendManagement());

    act(() => {
      result.current.openAddModal();
    });

    act(() => {
      result.current.createFriend({ id: "friend-2", name: "Maria" });
    });

    expect(result.current.showAddModal).toBe(true);

    unmount();
  });
});
