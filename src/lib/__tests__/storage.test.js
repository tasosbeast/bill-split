import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearState, loadState, saveState } from "../storage";
import { buildVersionedKey } from "../../services/storage";

const KEY = buildVersionedKey("bill-split");

function createMockStorage() {
  const store = new Map();
  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

describe("storage", () => {
  const localStorageMock = createMockStorage();

  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    globalThis.localStorage = localStorageMock;
  });

  it("sanitizes corrupted snapshots on load", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ friends: "oops", selectedId: "ghost", transactions: {} })
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const snapshot = loadState();

    expect(snapshot).toEqual({
      friends: [],
      selectedId: null,
      transactions: [],
      templates: [],
      settlements: [],
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/sanitized|defaults/i);
  });

  it("returns valid snapshots without warning", () => {
    const payload = {
      friends: [
        { id: "alice", name: "Alice" },
        { id: "bob", name: "Bob" },
      ],
      selectedId: "alice",
      transactions: [{ id: "t1", type: "split" }],
      templates: [],
      settlements: [],
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const snapshot = loadState();

    expect(snapshot).toEqual(payload);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("saves sanitized payloads when invalid data is provided", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    saveState({ friends: "oops", selectedId: "ghost", transactions: [{}] });

    expect(warnSpy).not.toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem(KEY));
    expect(stored).toEqual({
      version: 1,
      data: {
        friends: [],
        selectedId: null,
        transactions: [],
        templates: [],
        settlements: [],
      },
    });
  });

  it("clears the stored state", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ friends: [{ id: "alice" }], selectedId: null, transactions: [] })
    );

    clearState();

    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
