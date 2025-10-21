import { roundToCents } from "../lib/money.js";
import { createMemoryStorage, type StorageAdapter } from "./persistence";

const STORAGE_KEY = "bill-split:reminders";

const REMINDER_TRIGGER_LEVELS = ["low", "medium", "high"] as const;
export type ReminderTriggerLevel = (typeof REMINDER_TRIGGER_LEVELS)[number];

export const REMINDER_TRIGGER_PRESETS: Record<ReminderTriggerLevel, number> = {
  low: 10,
  medium: 25,
  high: 50,
};

const REMINDER_CHANNELS = ["email", "sms", "push"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export interface ReminderState {
  triggerLevel: ReminderTriggerLevel;
  threshold: number;
  snoozeHours: number;
  channels: ReminderChannel[];
  lastSent: Record<string, string>;
}

export type ReminderPreferences = Pick<
  ReminderState,
  "triggerLevel" | "threshold" | "snoozeHours" | "channels"
>;

export type RemindersListener = (state: ReminderState) => void;

const DEFAULT_STATE: ReminderState = {
  triggerLevel: "medium",
  threshold: REMINDER_TRIGGER_PRESETS.medium,
  snoozeHours: 72,
  channels: ["email"],
  lastSent: {},
};

let storageOverride: StorageAdapter | null = null;
let fallbackStorage: StorageAdapter | null = null;

const CHANNEL_LOOKUP = new Set<ReminderChannel>(REMINDER_CHANNELS);
const TRIGGER_LOOKUP = new Set<ReminderTriggerLevel>(REMINDER_TRIGGER_LEVELS);

const listeners = new Set<RemindersListener>();

function isStorageAdapter(value: unknown): value is StorageAdapter {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function" &&
    typeof candidate.removeItem === "function"
  );
}

function resolveNativeStorage(): StorageAdapter | null {
  if (typeof globalThis === "undefined") return null;
  const maybe = (globalThis as Record<string, unknown>).localStorage;
  return isStorageAdapter(maybe) ? maybe : null;
}

function ensureStorage(): StorageAdapter {
  if (storageOverride) return storageOverride;
  const native = resolveNativeStorage();
  if (native) return native;
  if (!fallbackStorage) {
    fallbackStorage = createMemoryStorage();
  }
  return fallbackStorage;
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function sanitizeLastSent(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const result: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (typeof rawKey !== "string") continue;
    const trimmedKey = rawKey.trim();
    if (!trimmedKey) continue;
    const iso = normalizeDate(rawValue);
    if (!iso) continue;
    result[trimmedKey] = iso;
  }
  return result;
}

function sanitizeThreshold(value: unknown, fallback: number): number {
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }
  return roundToCents(numeric);
}

function sanitizeSnooze(value: unknown, fallback: number): number {
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return rounded > 0 ? rounded : fallback;
}

function sanitizeChannels(input: unknown, fallback: ReminderChannel[]): ReminderChannel[] {
  if (!input) return [...fallback];
  const values = Array.isArray(input) ? input : [input];
  const selected = new Set<ReminderChannel>();
  for (const entry of values) {
    if (typeof entry !== "string") continue;
    const lowered = entry.trim().toLowerCase();
    if (!CHANNEL_LOOKUP.has(lowered as ReminderChannel)) continue;
    selected.add(lowered as ReminderChannel);
  }
  if (selected.size === 0) {
    for (const channel of fallback) {
      selected.add(channel);
    }
  }
  return REMINDER_CHANNELS.filter((channel) => selected.has(channel));
}

function sanitizeTriggerLevel(value: unknown, fallback: ReminderTriggerLevel): ReminderTriggerLevel {
  if (typeof value !== "string") return fallback;
  const lowered = value.trim().toLowerCase();
  return TRIGGER_LOOKUP.has(lowered as ReminderTriggerLevel)
    ? (lowered as ReminderTriggerLevel)
    : fallback;
}

function sanitizeState(input: unknown): ReminderState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_STATE, channels: [...DEFAULT_STATE.channels], lastSent: {} };
  }
  const raw = input as Partial<ReminderState> & Record<string, unknown>;
  const triggerLevel = sanitizeTriggerLevel(raw.triggerLevel, DEFAULT_STATE.triggerLevel);
  const threshold = sanitizeThreshold(
    raw.threshold ?? REMINDER_TRIGGER_PRESETS[triggerLevel] ?? DEFAULT_STATE.threshold,
    REMINDER_TRIGGER_PRESETS[triggerLevel] ?? DEFAULT_STATE.threshold
  );
  const snoozeHours = sanitizeSnooze(raw.snoozeHours, DEFAULT_STATE.snoozeHours);
  const channels = sanitizeChannels(raw.channels, DEFAULT_STATE.channels);
  const lastSent = sanitizeLastSent(raw.lastSent);
  return {
    triggerLevel,
    threshold,
    snoozeHours,
    channels,
    lastSent,
  };
}

function loadState(): ReminderState {
  const storage = ensureStorage();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return sanitizeState(null);
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeState(parsed);
  } catch (error) {
    console.warn("Failed to load reminder settings", error);
    return sanitizeState(null);
  }
}

let state: ReminderState = loadState();

function persistState(next: ReminderState): void {
  const storage = ensureStorage();
  const payload = JSON.stringify({
    triggerLevel: next.triggerLevel,
    threshold: roundToCents(next.threshold),
    snoozeHours: next.snoozeHours,
    channels: next.channels,
    lastSent: next.lastSent,
  });
  storage.setItem(STORAGE_KEY, payload);
}

function emit(): void {
  const snapshot = getRemindersState();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function applyState(next: ReminderState): void {
  state = sanitizeState(next);
  persistState(state);
  emit();
}

export function getRemindersState(): ReminderState {
  return {
    triggerLevel: state.triggerLevel,
    threshold: state.threshold,
    snoozeHours: state.snoozeHours,
    channels: [...state.channels],
    lastSent: { ...state.lastSent },
  };
}

export function subscribeReminders(listener: RemindersListener): () => void {
  listeners.add(listener);
  listener(getRemindersState());
  return () => {
    listeners.delete(listener);
  };
}

export function setReminderPreferences(updates: Partial<ReminderPreferences>): void {
  const current = getRemindersState();
  const nextLevel = updates.triggerLevel
    ? sanitizeTriggerLevel(updates.triggerLevel, current.triggerLevel)
    : current.triggerLevel;

  let nextThreshold: number;
  if (updates.threshold !== undefined) {
    nextThreshold = sanitizeThreshold(updates.threshold, current.threshold);
  } else if (updates.triggerLevel) {
    nextThreshold = sanitizeThreshold(
      REMINDER_TRIGGER_PRESETS[nextLevel] ?? current.threshold,
      current.threshold
    );
  } else {
    nextThreshold = current.threshold;
  }

  const nextState: ReminderState = {
    triggerLevel: nextLevel,
    threshold: nextThreshold,
    snoozeHours: sanitizeSnooze(updates.snoozeHours ?? current.snoozeHours, current.snoozeHours),
    channels: sanitizeChannels(updates.channels ?? current.channels, current.channels),
    lastSent: { ...state.lastSent },
  };
  applyState(nextState);
}

export function recordReminderSent(friendId: string, timestamp: Date | string = new Date()): void {
  if (typeof friendId !== "string") return;
  const trimmedId = friendId.trim();
  if (!trimmedId) return;
  const iso = normalizeDate(timestamp);
  if (!iso) return;
  applyState({
    ...state,
    lastSent: { ...state.lastSent, [trimmedId]: iso },
  });
}

export function clearReminderHistory(friendId?: string): void {
  if (typeof friendId === "string" && friendId.trim()) {
    const normalized = friendId.trim();
    if (!(normalized in state.lastSent)) return;
    const { [normalized]: _removed, ...rest } = state.lastSent;
    applyState({ ...state, lastSent: rest });
    return;
  }
  if (Object.keys(state.lastSent).length === 0) return;
  applyState({ ...state, lastSent: {} });
}

export function resetRemindersState(): void {
  state = sanitizeState(null);
  persistState(state);
  emit();
}

export function setRemindersStorage(storage: StorageAdapter | null): void {
  storageOverride = storage;
  if (!storage) {
    fallbackStorage = null;
  }
  state = loadState();
  emit();
}
