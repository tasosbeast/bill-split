import { describe, expect, it } from "vitest";
import {
  upgradeTransaction,
  upgradeTransactions,
  normalizeParticipants,
} from "../transactions";

describe("upgradeTransaction", () => {
  describe("legacy split objects", () => {
    it("upgrades split with friendId present and half amount", () => {
      const legacy = {
        id: "tx-1",
        type: "split",
        total: 100,
        friendId: "friend-1",
        half: 50,
        payer: "you",
        category: "Food",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.type).toBe("split");
      expect(upgraded.total).toBe(100);
      expect(upgraded.friendId).toBe("friend-1");
      expect(upgraded.friendIds).toEqual(["friend-1"]);
      expect(upgraded.participants).toHaveLength(2);
      expect(upgraded.participants[0]).toEqual({ id: "you", amount: 50 });
      expect(upgraded.participants[1]).toEqual({ id: "friend-1", amount: 50 });
      expect(upgraded.effects).toHaveLength(1);
      expect(upgraded.effects[0]).toEqual({
        friendId: "friend-1",
        share: 50,
        delta: 50,
      });
    });

    it("upgrades split without friendId", () => {
      const legacy = {
        id: "tx-2",
        type: "split",
        total: 80,
        payer: "you",
        category: "Travel",
        createdAt: "2024-01-02T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.type).toBe("split");
      expect(upgraded.total).toBe(80);
      // friendId can be null or undefined for transactions without friends
      expect(upgraded.friendId == null).toBe(true);
      expect(upgraded.friendIds).toEqual([]);
      // Without friendId, participants will still be computed with default split logic
      expect(upgraded.participants).toHaveLength(1); // Only "you"
      expect(upgraded.participants[0].id).toBe("you");
    });

    it("upgrades split with friendId but no half (defaults to total/2)", () => {
      const legacy = {
        id: "tx-3",
        type: "split",
        total: 60,
        friendId: "friend-2",
        payer: "you",
        category: "Entertainment",
        createdAt: "2024-01-03T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.friendId).toBe("friend-2");
      expect(upgraded.participants).toHaveLength(2);
      expect(upgraded.participants[0].amount).toBe(30); // total - (total/2)
      expect(upgraded.participants[1].amount).toBe(30); // total/2
    });

    it("upgrades split with payer=friend", () => {
      const legacy = {
        id: "tx-4",
        type: "split",
        total: 100,
        friendId: "friend-3",
        half: 40,
        payer: "friend",
        category: "Food",
        createdAt: "2024-01-04T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.payer).toBe("friend-3"); // payer="friend" normalized to actual friendId
      expect(upgraded.effects[0]).toEqual({
        friendId: "friend-3",
        share: 40,
        delta: -60, // friend paid, you owe them your share
      });
    });

    it("rounds half amounts to cents", () => {
      const legacy = {
        id: "tx-5",
        type: "split",
        total: 100.01,
        friendId: "friend-4",
        half: 50.005, // Should round to 50.01
        payer: "you",
        category: "Other",
        createdAt: "2024-01-05T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.participants[0].amount).toBe(50); // 100.01 - 50.01
      expect(upgraded.participants[1].amount).toBe(50.01); // rounded
      expect(upgraded.effects[0].share).toBe(50.01);
    });

    it("handles edge case: total exactly splits in half", () => {
      const legacy = {
        id: "tx-6",
        type: "split",
        total: 50,
        friendId: "friend-5",
        payer: "you",
        category: "Food",
        createdAt: "2024-01-06T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.participants[0].amount).toBe(25);
      expect(upgraded.participants[1].amount).toBe(25);
    });

    it("handles edge case: total with odd cents", () => {
      const legacy = {
        id: "tx-7",
        type: "split",
        total: 10.01,
        friendId: "friend-6",
        payer: "you",
        category: "Food",
        createdAt: "2024-01-07T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      // total/2 = 5.005 rounds to 5.01
      // you share = 10.01 - 5.01 = 5.00
      expect(upgraded.participants[0].amount).toBe(5); 
      expect(upgraded.participants[1].amount).toBe(5.01);
    });

    it("returns null for invalid split (non-positive total)", () => {
      const legacy = {
        id: "tx-bad",
        type: "split",
        total: 0,
        friendId: "friend-7",
        payer: "you",
        category: "Food",
        createdAt: "2024-01-08T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).toBeNull();
    });

    it("returns null for invalid split (negative total)", () => {
      const legacy = {
        id: "tx-bad-2",
        type: "split",
        total: -50,
        friendId: "friend-8",
        payer: "you",
        category: "Food",
        createdAt: "2024-01-09T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).toBeNull();
    });
  });

  describe("settlement objects", () => {
    it("upgrades settlement with positive delta (you paid them)", () => {
      const legacy = {
        id: "settle-1",
        type: "settlement",
        friendId: "friend-10",
        delta: 50,
        createdAt: "2024-02-01T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.type).toBe("settlement");
      expect(upgraded.friendId).toBe("friend-10");
      expect(upgraded.friendIds).toEqual(["friend-10"]);
      expect(upgraded.effects).toHaveLength(1);
      expect(upgraded.effects[0]).toEqual({
        friendId: "friend-10",
        delta: 50,
        share: 50,
      });
    });

    it("upgrades settlement with negative delta (they paid you)", () => {
      const legacy = {
        id: "settle-2",
        type: "settlement",
        friendId: "friend-11",
        delta: -75,
        createdAt: "2024-02-02T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.effects[0]).toEqual({
        friendId: "friend-11",
        delta: -75,
        share: 75, // absolute value
      });
    });

    it("upgrades settlement with zero delta", () => {
      const legacy = {
        id: "settle-3",
        type: "settlement",
        friendId: "friend-12",
        delta: 0,
        createdAt: "2024-02-03T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(legacy);

      expect(upgraded).not.toBeNull();
      expect(upgraded.effects[0].delta).toBe(0);
      expect(upgraded.effects[0].share).toBe(0);
    });

    it("passes through settlement with existing effects and friendIds", () => {
      const modern = {
        id: "settle-4",
        type: "settlement",
        friendId: "friend-13",
        friendIds: ["friend-13"],
        delta: 100,
        effects: [
          {
            friendId: "friend-13",
            delta: 100,
            share: 100,
          },
        ],
        createdAt: "2024-02-04T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(modern);

      expect(upgraded).not.toBeNull();
      // Should preserve existing effects and friendIds
      expect(upgraded.friendIds).toEqual(["friend-13"]);
      expect(upgraded.effects).toEqual(modern.effects);
    });
  });

  describe("already-upgraded transactions", () => {
    it("passes through transaction with effects and participants already present", () => {
      const modern = {
        id: "tx-modern",
        type: "split",
        total: 100,
        payer: "you",
        participants: [
          { id: "you", amount: 60 },
          { id: "friend-14", amount: 40 },
        ],
        effects: [
          {
            friendId: "friend-14",
            share: 40,
            delta: 40,
          },
        ],
        friendId: "friend-14",
        friendIds: ["friend-14"],
        category: "Food",
        createdAt: "2024-03-01T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(modern);

      expect(upgraded).not.toBeNull();
      expect(upgraded.participants).toEqual(modern.participants);
      expect(upgraded.effects).toEqual(modern.effects);
      expect(upgraded.friendIds).toEqual(["friend-14"]);
    });

    it("derives friendId from friendIds if missing", () => {
      const modern = {
        id: "tx-modern-2",
        type: "split",
        total: 100,
        payer: "you",
        participants: [
          { id: "you", amount: 60 },
          { id: "friend-15", amount: 40 },
        ],
        effects: [
          {
            friendId: "friend-15",
            share: 40,
            delta: 40,
          },
        ],
        friendIds: ["friend-15"],
        category: "Food",
        createdAt: "2024-03-02T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(modern);

      expect(upgraded).not.toBeNull();
      expect(upgraded.friendId).toBe("friend-15");
    });

    it("sets friendId to null when multiple friendIds", () => {
      const modern = {
        id: "tx-modern-3",
        type: "split",
        total: 150,
        payer: "you",
        participants: [
          { id: "you", amount: 50 },
          { id: "friend-16", amount: 50 },
          { id: "friend-17", amount: 50 },
        ],
        effects: [
          { friendId: "friend-16", share: 50, delta: 50 },
          { friendId: "friend-17", share: 50, delta: 50 },
        ],
        friendIds: ["friend-16", "friend-17"],
        category: "Food",
        createdAt: "2024-03-03T00:00:00.000Z",
      };

      const upgraded = upgradeTransaction(modern);

      expect(upgraded).not.toBeNull();
      expect(upgraded.friendId).toBeNull(); // Multi-friend splits have null friendId
      expect(upgraded.friendIds).toEqual(["friend-16", "friend-17"]);
    });
  });

  describe("invalid or edge cases", () => {
    it("returns null for null input", () => {
      const upgraded = upgradeTransaction(null);
      expect(upgraded).toBeNull();
    });

    it("returns null for undefined input", () => {
      const upgraded = upgradeTransaction(undefined);
      expect(upgraded).toBeNull();
    });

    it("passes through unrecognized transaction types", () => {
      const unknown = {
        id: "tx-unknown",
        type: "unknown-type",
        data: "some data",
      };

      const upgraded = upgradeTransaction(unknown);

      expect(upgraded).toEqual(unknown); // Pass through as-is
    });
  });
});

describe("upgradeTransactions", () => {
  it("upgrades array of mixed legacy and modern transactions", () => {
    const list = [
      {
        id: "tx-1",
        type: "split",
        total: 100,
        friendId: "friend-1",
        half: 50,
        payer: "you",
        category: "Food",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "settle-1",
        type: "settlement",
        friendId: "friend-2",
        delta: 50,
        createdAt: "2024-01-02T00:00:00.000Z",
      },
      {
        id: "tx-modern",
        type: "split",
        total: 80,
        payer: "you",
        participants: [
          { id: "you", amount: 40 },
          { id: "friend-3", amount: 40 },
        ],
        effects: [{ friendId: "friend-3", share: 40, delta: 40 }],
        friendId: "friend-3",
        friendIds: ["friend-3"],
        category: "Travel",
        createdAt: "2024-01-03T00:00:00.000Z",
      },
    ];

    const upgraded = upgradeTransactions(list);

    expect(upgraded).toHaveLength(3);
    expect(upgraded[0].friendIds).toEqual(["friend-1"]);
    expect(upgraded[1].effects).toHaveLength(1);
    expect(upgraded[2].friendId).toBe("friend-3");
  });

  it("filters out null results from invalid transactions", () => {
    const list = [
      {
        id: "tx-valid",
        type: "split",
        total: 100,
        friendId: "friend-1",
        payer: "you",
        category: "Food",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "tx-invalid",
        type: "split",
        total: 0, // Invalid: zero total
        friendId: "friend-2",
        payer: "you",
        category: "Food",
        createdAt: "2024-01-02T00:00:00.000Z",
      },
    ];

    const upgraded = upgradeTransactions(list);

    expect(upgraded).toHaveLength(1); // Only valid transaction
    expect(upgraded[0].id).toBe("tx-valid");
  });

  it("handles empty array", () => {
    const upgraded = upgradeTransactions([]);
    expect(upgraded).toEqual([]);
  });

  it("handles undefined input", () => {
    const upgraded = upgradeTransactions(undefined);
    expect(upgraded).toEqual([]);
  });
});

describe("normalizeParticipants", () => {
  it("normalizes valid participants with amounts", () => {
    const raw = [
      { id: "you", amount: 50 },
      { id: "friend-1", amount: 50 },
    ];

    const normalized = normalizeParticipants(raw);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({ id: "you", amount: 50 });
    expect(normalized[1]).toEqual({ id: "friend-1", amount: 50 });
  });

  it("ensures 'you' participant exists at front", () => {
    const raw = [{ id: "friend-1", amount: 100 }];

    const normalized = normalizeParticipants(raw);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].id).toBe("you");
    expect(normalized[0].amount).toBe(0);
    expect(normalized[1]).toEqual({ id: "friend-1", amount: 100 });
  });

  it("deduplicates participants by id", () => {
    const raw = [
      { id: "friend-1", amount: 50 },
      { id: "friend-1", amount: 30 }, // Duplicate, should be ignored
      { id: "friend-2", amount: 20 },
    ];

    const normalized = normalizeParticipants(raw);

    expect(normalized).toHaveLength(3); // you + friend-1 + friend-2
    expect(normalized.filter((p) => p.id === "friend-1")).toHaveLength(1);
    expect(normalized.find((p) => p.id === "friend-1")?.amount).toBe(50); // First occurrence
  });

  it("trims participant ids", () => {
    const raw = [{ id: "  friend-1  ", amount: 50 }];

    const normalized = normalizeParticipants(raw);

    expect(normalized[1].id).toBe("friend-1");
  });

  it("rounds amounts to cents", () => {
    const raw = [
      { id: "friend-1", amount: 50.005 },
      { id: "friend-2", amount: 30.999 },
    ];

    const normalized = normalizeParticipants(raw);

    expect(normalized.find((p) => p.id === "friend-1")?.amount).toBe(50.01);
    expect(normalized.find((p) => p.id === "friend-2")?.amount).toBe(31);
  });

  it("handles invalid amounts by setting to 0", () => {
    const raw = [
      { id: "friend-1", amount: NaN },
      { id: "friend-2", amount: Infinity },
      { id: "friend-3", amount: "not-a-number" },
    ];

    const normalized = normalizeParticipants(raw);

    normalized.forEach((p) => {
      if (p.id !== "you") {
        expect(p.amount).toBe(0);
      }
    });
  });

  it("handles empty array", () => {
    const normalized = normalizeParticipants([]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual({ id: "you", amount: 0 });
  });

  it("handles undefined input", () => {
    const normalized = normalizeParticipants(undefined);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual({ id: "you", amount: 0 });
  });

  it("filters out invalid entries (null, non-objects)", () => {
    const raw = [
      null,
      undefined,
      { id: "friend-1", amount: 50 },
      "not-an-object",
      { id: "friend-2", amount: 30 },
    ];

    const normalized = normalizeParticipants(raw);

    expect(normalized).toHaveLength(3); // you + friend-1 + friend-2
  });

  it("filters out entries with empty or missing ids", () => {
    const raw = [
      { id: "", amount: 50 },
      { id: "   ", amount: 30 },
      { amount: 20 }, // No id
      { id: "friend-1", amount: 40 },
    ];

    const normalized = normalizeParticipants(raw);

    expect(normalized).toHaveLength(2); // you + friend-1
  });
});
