import type {
  LegacyFriend,
  UISnapshot,
} from "../types/legacySnapshot";

const SAMPLE_FRIENDS: LegacyFriend[] = [
  {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `friend-${Date.now()}-1`,
    name: "Valia",
    email: "valia@example.com",
  },
  {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `friend-${Date.now()}-2`,
    name: "Nikos",
    email: "nikos@example.com",
  },
];

export function createDefaultSnapshot(): UISnapshot {
  return {
    friends: SAMPLE_FRIENDS.map((friend) => ({ ...friend })),
    selectedId: null,
    transactions: [],
    templates: [],
  };
}

