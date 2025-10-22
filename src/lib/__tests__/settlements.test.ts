import { describe, expect, it } from "vitest";
import {
  buildSettlementContext,
  deriveSettlementAmounts,
  extractSettlementDelta,
  extractSettlementFriendId,
  normalizeSettlementStatus,
} from "../settlements";

describe("settlement helpers", () => {
  describe("normalizeSettlementStatus", () => {
    it("returns fallback for unknown values", () => {
      expect(normalizeSettlementStatus("unknown", "initiated")).toBe(
        "initiated"
      );
    });

    it("normalizes different casing", () => {
      expect(normalizeSettlementStatus(" ConFirmed ", "initiated")).toBe(
        "confirmed"
      );
    });

    it("maps american spelling to canonical form", () => {
      expect(normalizeSettlementStatus("canceled", "pending")).toBe(
        "cancelled"
      );
    });
  });

  describe("extractSettlementFriendId", () => {
    it("uses explicit friendId when available", () => {
      expect(
        extractSettlementFriendId(
          {
            friendId: "friend-1",
            friendIds: null,
            effects: null,
          } as never
        )
      ).toBe("friend-1");
    });

    it("falls back to effects when friendId missing", () => {
      expect(
        extractSettlementFriendId(
          {
            friendId: null,
            friendIds: [],
            effects: [{ friendId: "friend-2", delta: 0, share: 0 }],
          } as never
        )
      ).toBe("friend-2");
    });
  });

  describe("extractSettlementDelta", () => {
    it("prefers effect delta values", () => {
      expect(
        extractSettlementDelta({
          effects: [{ friendId: "friend-2", delta: -12, share: 12 }],
          participants: [],
        } as never)
      ).toBe(-12);
    });

    it("derives from participants when effects missing", () => {
      expect(
        extractSettlementDelta({
          effects: [],
          participants: [
            { id: "you", amount: 0 },
            { id: "friend-3", amount: 14 },
          ],
        } as never)
      ).toBe(-14);
    });
  });

  describe("deriveSettlementAmounts", () => {
    it("reuses existing delta when balance missing", () => {
      expect(
        deriveSettlementAmounts(undefined, -18)
      ).toEqual({
        delta: -18,
        friendShare: 18,
        youShare: 0,
        share: 18,
      });
    });

    it("computes values from provided balance", () => {
      expect(
        deriveSettlementAmounts(20, 0)
      ).toEqual({
        delta: -20,
        friendShare: 20,
        youShare: 0,
        share: 20,
      });
    });
  });

  describe("buildSettlementContext", () => {
    it("summarizes friend id and balance", () => {
      expect(
        buildSettlementContext({
          friendId: "friend-5",
          friendIds: null,
          effects: [{ friendId: "friend-5", delta: -25, share: 25 }],
          participants: [],
        } as never)
      ).toEqual({
        friendId: "friend-5",
        balance: 25,
      });
    });
  });
});
