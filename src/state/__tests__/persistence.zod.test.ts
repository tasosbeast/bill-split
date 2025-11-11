import { describe, expect, it, beforeEach } from "vitest";
import {
  parsePersistedEnvelope,
  PersistedTransactionSchema,
  PersistedParticipantSchema,
} from "../schemas";
import {
  createMemoryStorage,
  setTransactionsPersistenceStorage,
  loadTransactionsState,
  persistTransactionsState,
  clearTransactionsStatePersistence,
} from "../persistence";

describe("Zod-based persistence validation", () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    setTransactionsPersistenceStorage(storage);
    clearTransactionsStatePersistence();
  });

  describe("parsePersistedEnvelope", () => {
    it("parses legacy bare payload (no version)", () => {
      const legacyPayload = {
        transactions: [
          {
            id: "t1",
            type: "split",
            category: "Food",
            total: 100,
            participants: [
              { id: "you", amount: 50 },
              { id: "friend1", amount: 50 },
            ],
          },
        ],
        budgets: {
          Food: 500,
        },
      };

      const result = parsePersistedEnvelope(legacyPayload);

      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.payload.transactions).toHaveLength(1);
      expect(result?.payload.transactions[0].id).toBe("t1");
      expect(result?.payload.budgets).toEqual({ Food: 500 });
    });

    it("parses new versioned envelope format", () => {
      const versionedPayload = {
        version: 1,
        payload: {
          transactions: [
            {
              id: "t2",
              type: "settlement",
              total: 75,
              participants: [
                { id: "you", amount: -75 },
                { id: "friend2", amount: 75 },
              ],
              settlementStatus: "confirmed",
            },
          ],
          budgets: {
            Travel: 200,
          },
        },
      };

      const result = parsePersistedEnvelope(versionedPayload);

      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.payload.transactions).toHaveLength(1);
      expect(result?.payload.transactions[0].type).toBe("settlement");
      expect(result?.payload.budgets).toEqual({ Travel: 200 });
    });

    it("returns null for invalid data", () => {
      expect(parsePersistedEnvelope(null)).toBeNull();
      expect(parsePersistedEnvelope(undefined)).toBeNull();
      expect(parsePersistedEnvelope("invalid")).toBeNull();
      expect(parsePersistedEnvelope(123)).toBeNull();
      expect(parsePersistedEnvelope([])).toBeNull();
    });
  });

  describe("PersistedParticipantSchema", () => {
    it("coerces string amounts to numbers", () => {
      const result = PersistedParticipantSchema.parse({
        id: "friend1",
        amount: "42.50",
      });

      expect(result.id).toBe("friend1");
      expect(result.amount).toBe(42.5);
    });

    it("rounds amounts to cents", () => {
      const result = PersistedParticipantSchema.parse({
        id: "friend2",
        amount: 12.3456,
      });

      expect(result.amount).toBe(12.35);
    });

    it("coerces numeric IDs to strings", () => {
      const result = PersistedParticipantSchema.parse({
        id: 123,
        amount: 25,
      });

      expect(result.id).toBe("123");
    });

    it("defaults to 0 for invalid amounts", () => {
      const result = PersistedParticipantSchema.parse({
        id: "friend3",
        amount: "not-a-number",
      });

      expect(result.amount).toBe(0);
    });
  });

  describe("PersistedTransactionSchema", () => {
    it("normalizes 'canceled' to 'cancelled' for settlement status", () => {
      const result = PersistedTransactionSchema.parse({
        id: "s1",
        type: "settlement",
        settlementStatus: "canceled",
      });

      expect(result.settlementStatus).toBe("cancelled");
    });

    it("validates settlement status values", () => {
      const validStatuses = ["initiated", "pending", "confirmed", "cancelled"];
      
      for (const status of validStatuses) {
        const result = PersistedTransactionSchema.parse({
          id: "s1",
          type: "settlement",
          settlementStatus: status,
        });
        expect(result.settlementStatus).toBe(status);
      }
    });

    it("filters invalid participants", () => {
      const result = PersistedTransactionSchema.parse({
        id: "t1",
        participants: [
          { id: "valid", amount: 50 },
          { id: "", amount: 25 }, // invalid - empty id
          { amount: 30 }, // invalid - missing id
          { id: "valid2", amount: "abc" }, // valid with coerced amount to 0
        ],
      });

      expect(result.participants).toHaveLength(2);
      expect(result.participants?.[0].id).toBe("valid");
      expect(result.participants?.[1].id).toBe("valid2");
      expect(result.participants?.[1].amount).toBe(0);
    });

    it("sanitizes payment metadata to null for non-objects", () => {
      const testCases = [
        { payment: "string", expected: null },
        { payment: 123, expected: null },
        { payment: [], expected: null },
        { payment: null, expected: null },
      ];

      for (const { payment, expected } of testCases) {
        const result = PersistedTransactionSchema.parse({
          id: "t1",
          payment,
        });
        expect(result.payment).toBe(expected);
      }
    });

    it("preserves valid payment metadata", () => {
      const paymentMetadata = {
        method: "card",
        reference: "REF123",
        provider: "Stripe",
      };

      const result = PersistedTransactionSchema.parse({
        id: "t1",
        payment: paymentMetadata,
      });

      expect(result.payment).toEqual(paymentMetadata);
    });

    it("preserves arbitrary transaction fields with passthrough", () => {
      const result = PersistedTransactionSchema.parse({
        id: "t1",
        type: "split",
        customField: "custom value",
        anotherField: 42,
      });

      expect(result.customField).toBe("custom value");
      expect(result.anotherField).toBe(42);
    });
  });

  describe("Budgets validation", () => {
    it("filters out negative budgets", () => {
      const payload = {
        transactions: [],
        budgets: {
          Food: 100,
          Travel: -50, // should be filtered
          Entertainment: 0,
        },
      };

      const result = parsePersistedEnvelope(payload);
      
      expect(result?.payload.budgets).toEqual({
        Food: 100,
        Entertainment: 0,
      });
    });

    it("rounds budget values to cents", () => {
      const payload = {
        transactions: [],
        budgets: {
          Food: 123.456,
          Travel: 99.995,
        },
      };

      const result = parsePersistedEnvelope(payload);
      
      expect(result?.payload.budgets.Food).toBe(123.46);
      expect(result?.payload.budgets.Travel).toBe(100);
    });

    it("coerces numeric string budgets", () => {
      const payload = {
        transactions: [],
        budgets: {
          Food: "250.50",
        },
      };

      const result = parsePersistedEnvelope(payload);
      
      expect(result?.payload.budgets.Food).toBe(250.5);
    });

    it("filters out invalid budget values", () => {
      const payload = {
        transactions: [],
        budgets: {
          Food: 100,
          Travel: "not-a-number",
          Entertainment: NaN,
          Drinks: Infinity,
        },
      };

      const result = parsePersistedEnvelope(payload);
      
      expect(result?.payload.budgets).toEqual({
        Food: 100,
      });
    });
  });

  describe("Integration with persistence functions", () => {
    it("loads and persists transactions with Zod validation", () => {
      const testState = {
        transactions: [
          {
            id: "t1",
            type: "split",
            category: "Food",
            total: 100,
            participants: [
              { id: "you", amount: 50 },
              { id: "friend1", amount: 50 },
            ],
          },
        ],
        budgets: {
          Food: 500,
        },
      };

      persistTransactionsState(testState);
      const loaded = loadTransactionsState();

      expect(loaded).not.toBeNull();
      expect(loaded?.transactions).toHaveLength(1);
      expect(loaded?.transactions[0].id).toBe("t1");
      expect(loaded?.budgets).toEqual({ Food: 500 });
    });

    it("coerces and sanitizes data on round-trip", () => {
      const messyState = {
        transactions: [
          {
            id: "t1",
            type: "split",
            total: "99.999", // string number
            participants: [
              { id: 123, amount: "50.5" }, // coerced
              { id: "", amount: 25 }, // invalid - will be filtered
            ],
          },
        ],
        budgets: {
          Food: "123.456", // string
          Invalid: -50, // negative
        },
      };

      persistTransactionsState(messyState);
      const loaded = loadTransactionsState();

      expect(loaded?.transactions[0].participants).toHaveLength(1);
      expect(loaded?.transactions[0].participants?.[0].id).toBe("123");
      expect(loaded?.transactions[0].participants?.[0].amount).toBe(50.5);
      expect(loaded?.budgets).toEqual({ Food: 123.46 });
    });

    it("handles settlement status normalization", () => {
      const settlementState = {
        transactions: [
          {
            id: "s1",
            type: "settlement",
            settlementStatus: "canceled", // should normalize to "cancelled"
            total: 50,
            participants: [
              { id: "you", amount: -50 },
              { id: "friend1", amount: 50 },
            ],
          },
        ],
        budgets: {},
      };

      persistTransactionsState(settlementState);
      const loaded = loadTransactionsState();

      expect(loaded?.transactions[0].settlementStatus).toBe("cancelled");
    });
  });
});
