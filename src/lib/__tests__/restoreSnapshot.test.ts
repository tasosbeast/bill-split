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
    expect(result.friends[0]).toMatchObject({
      id: "friend-1",
      name: "Alex",
      email: "alex@example.com",
      tag: "friend",
    });
    // active and createdAt are added during restoration
    expect(result.friends[0]).toHaveProperty("active", true);
    expect(result.friends[0]).toHaveProperty("createdAt");
    expect(typeof result.friends[0].createdAt).toBe("number");

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
    const payload = {
      ...data,
      transactions: [
        {
          id: "tx-unknown",
          type: "split",
          total: 10,
          payer: "you",
          participants: [
            { id: "you", amount: 5 },
            { id: "friend-1", amount: 5 },
          ],
          note: "",
          category: "mystery-category",
          createdAt: "2024-05-01T00:00:00.000Z",
        },
      ],
    } as unknown;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = restoreSnapshot(payload);

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
    const calls: unknown[][] = warnSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1];
    expect(Array.isArray(lastCall)).toBe(true);
    if (!Array.isArray(lastCall)) {
      return;
    }

    const message: unknown = lastCall[0];
    const details: unknown = lastCall[1];
    expect(typeof message).toBe("string");
    if (typeof message === "string") {
      expect(message).toBe("Merging duplicate friend by email during restore:");
    }
    expect(details && typeof details === "object").toBe(true);
    if (details && typeof details === "object") {
      const record = details as Record<string, unknown>;
      const dropped = record.dropped;
      expect(dropped && typeof dropped === "object").toBe(true);
      if (dropped && typeof dropped === "object") {
        const droppedRecord = dropped as Record<string, unknown>;
        expect(droppedRecord.id).toBe("friend-2");
      }
    }
  });

  it("tracks skipped transactions with context when entries are invalid", () => {
    const data = baseData();
    const payload = {
      ...data,
      transactions: [
        null,
        {
          id: "tx-invalid",
          type: "split",
          total: 20,
          payer: "you",
          participants: [{ id: "you", amount: 10 }],
          note: "",
          category: "Food",
          createdAt: "2024-05-02T00:00:00.000Z",
        },
        {
          id: "tx-valid",
          type: "split",
          total: 12,
          payer: "you",
          participants: [
            { id: "you", amount: 6 },
            { id: "friend-1", amount: 6 },
          ],
          note: "",
          category: "Food",
          createdAt: "2024-05-03T00:00:00.000Z",
        },
      ],
    } as unknown;

    const result = restoreSnapshot(payload);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].id).toBe("tx-valid");

    expect(result.skippedTransactions).toHaveLength(2);
    const notObject = result.skippedTransactions.find(
      (entry) => entry.reason === "Transaction entry was not an object",
    );
    expect(notObject?.transaction).toBeNull();
    const invalidSplit = result.skippedTransactions.find(
      (entry) => entry.reason === "Split is missing friend participants",
    );
    expect(invalidSplit).toBeTruthy();
    const invalidTx = invalidSplit?.transaction;
    expect(invalidTx && typeof invalidTx === "object").toBe(true);
    if (invalidTx && typeof invalidTx === "object") {
      const txRecord = invalidTx as Record<string, unknown>;
      expect(txRecord.id).toBe("tx-invalid");
    }
  });
});
