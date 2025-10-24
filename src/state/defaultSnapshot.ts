import type { UISnapshot } from "../types/legacySnapshot";
import type { Friend } from "../types/domain";

const SAMPLE_FRIENDS: Friend[] = [
  {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `friend-${Date.now()}-1`,
    name: "Valia",
    email: "valia@example.com",
    avatarUrl: undefined,
    active: true,
    createdAt: Date.now(),
    tag: "friend",
  },
  {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `friend-${Date.now()}-2`,
    name: "Nikos",
    email: "nikos@example.com",
    avatarUrl: undefined,
    active: true,
    createdAt: Date.now(),
    tag: "friend",
  },
];

export function createDefaultSnapshot(): UISnapshot {
  return {
    friends: SAMPLE_FRIENDS.map((friend) => ({ ...friend })),
    selectedId: null,
    transactions: [],
    templates: [],
    settlements: [],
  };
}
