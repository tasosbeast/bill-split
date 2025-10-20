import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { restoreSnapshot } from "../restoreSnapshot";

function baseData() {
  return {
    friends: [
      { id: "friend-1", name: " Alex ", email: "alex@example.com" },
      { id: "friend-2", name: "Taylor", email: "alex@example.com" },
    ],
    selectedId: "friend-1",
    transactions: [
      {
        id: "tx-1",
        type: "split",
        total: 42.5,
        payer: "friend",
        participants: [
          { id: "you", amount: 20 },
          { id: "friend-1", amount: 22.5 },
        ],
        note: "Dinner",
        category: "Food",
        createdAt: "2024-05-01T00:00:00.000Z",
      },
    ],
  };
}

describe("restoreSnapshot", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores friends and split transactions with sanitized values", () => {
    const data = baseData();
    const result = restoreSnapshot(data);

    expect(result.friends).toHaveLength(1);
    expect(result.friends[0]).toEqual({
      id: "friend-1",
      name: "Alex",
      email: "alex@example.com",
      tag: "friend",
    });

    expect(result.selectedId).toBe("friend-1");
    expect(result.transactions).toHaveLength(1);
    expect(result.skippedTransactions).toHaveLength(0);

    const [transaction] = result.transactions;
    expect(transaction).toMatchObject({
      id: "tx-1",
      type: "split",
      category: "Food",
      payer: "friend-1",
      friendIds: ["friend-1"],
    });
    expect(transaction.participants).toEqual([
      { id: "you", amount: 20 },
      { id: "friend-1", amount: 22.5 },
    ]);
  });

  it("defaults unknown categories to 'Other' and reports the warning", () => {
    const data = baseData();
    data.transactions = [
      {
        id: "tx-unknown",
        type: "split",
        total: 10,
        payer: "you",
        participants: [
          { id: "you", amount: 5 },
          { id: "friend-1", amount: 5 },
        ],
        category: "mystery-category",
      },
    ];

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = restoreSnapshot(data);

    expect(result.transactions[0].category).toBe("Other");
    expect(warnSpy).toHaveBeenCalledWith(
      "Unknown category during restore, defaulting to 'Other':",
      "mystery-category",
    );
  });

  it("merges duplicate friends by email and skips the duplicate entry", () => {
    const data = baseData();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = restoreSnapshot(data);

    expect(result.friends).toHaveLength(1);
    expect(result.friends[0].id).toBe("friend-1");
    expect(warnSpy).toHaveBeenCalledWith(
      "Merging duplicate friend by email during restore:",
      expect.objectContaining({
        kept: expect.any(Object),
        dropped: expect.objectContaining({ id: "friend-2" }),
      }),
    );
  });

  it("tracks skipped transactions with context when entries are invalid", () => {
    const data = baseData();
    data.transactions = [
      null,
      {
        id: "tx-invalid",
        type: "split",
        total: 20,
        participants: [{ id: "you", amount: 10 }],
        category: "Food",
      },
      {
        id: "tx-valid",
        type: "split",
        total: 12,
        participants: [
          { id: "you", amount: 6 },
          { id: "friend-1", amount: 6 },
        ],
        category: "Food",
      },
    ];

    const result = restoreSnapshot(data);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].id).toBe("tx-valid");

    expect(result.skippedTransactions).toEqual([
      {
        transaction: null,
        reason: "Transaction entry was not an object",
      },
      {
        transaction: expect.objectContaining({ id: "tx-invalid" }),
        reason: "Split is missing friend participants",
      },
    ]);
  });
});
