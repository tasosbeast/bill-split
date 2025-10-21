import { roundToCents } from "./money.js";
import {
  getRemindersState,
  recordReminderSent,
} from "../state/remindersStore";
import type { ReminderChannel } from "../state/remindersStore";

export interface FriendBalanceSummary {
  friendId: string;
  balance: number;
  lastTransactionAt?: string | Date | null;
}

export interface ReminderJob {
  friendId: string;
  balance: number;
  overdueBy: number;
  channels: ReminderChannel[];
  sendAt: Date;
  lastSentAt: Date | null;
}

export interface SnoozedReminder {
  friendId: string;
  balance: number;
  lastSentAt: Date;
  retryAt: Date;
}

export interface ReminderEvaluation {
  due: ReminderJob[];
  snoozed: SnoozedReminder[];
  nextRunAt: Date;
  threshold: number;
  snoozeHours: number;
}

const HOURS_TO_MS = 60 * 60 * 1000;
const DEFAULT_REEVALUATE_HOURS = 6;

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function ensureDate(value: unknown, fallback: Date): Date {
  const parsed = toDate(value);
  return parsed ?? fallback;
}

function normalizePositive(value: number): number {
  return roundToCents(Math.max(0, Number.isFinite(value) ? value : 0));
}

function considerNextRun(current: Date | null, candidate: Date, now: Date): Date {
  const nowTime = now.getTime();
  const candidateTime = candidate.getTime();
  if (Number.isNaN(candidateTime)) {
    return current ?? now;
  }
  const normalizedTime = Math.max(candidateTime, nowTime);
  if (!current) {
    return new Date(normalizedTime);
  }
  return normalizedTime < current.getTime() ? new Date(normalizedTime) : current;
}

export function evaluateReminders(
  balances: FriendBalanceSummary[],
  nowInput: Date | string = new Date()
): ReminderEvaluation {
  const now = ensureDate(nowInput, new Date());
  const nowTime = now.getTime();
  const config = getRemindersState();
  const threshold = roundToCents(Math.max(0, config.threshold));
  const snoozeMs = Math.max(1, config.snoozeHours) * HOURS_TO_MS;

  const due: ReminderJob[] = [];
  const snoozed: SnoozedReminder[] = [];
  let nextRunAt: Date | null = null;

  for (const entry of balances) {
    if (!entry || typeof entry.friendId !== "string") continue;
    const friendId = entry.friendId.trim();
    if (!friendId) continue;
    const balance = normalizePositive(entry.balance);
    if (balance <= 0 || balance < threshold) {
      continue;
    }

    const lastSentRaw = config.lastSent[friendId];
    const lastSentAt = lastSentRaw ? toDate(lastSentRaw) : null;

    if (lastSentAt) {
      const retryAt = new Date(lastSentAt.getTime() + snoozeMs);
      if (retryAt.getTime() > nowTime) {
        snoozed.push({
          friendId,
          balance,
          lastSentAt,
          retryAt,
        });
        nextRunAt = considerNextRun(nextRunAt, retryAt, now);
        continue;
      }
    }

    const overdueBy = roundToCents(balance - threshold);
    const sendAt = new Date(nowTime);
    due.push({
      friendId,
      balance,
      overdueBy,
      channels: [...config.channels],
      sendAt,
      lastSentAt: lastSentAt ?? null,
    });
    const retryAfter = new Date(nowTime + snoozeMs);
    nextRunAt = considerNextRun(nextRunAt, retryAfter, now);
  }

  if (!nextRunAt) {
    const fallback = new Date(nowTime + DEFAULT_REEVALUATE_HOURS * HOURS_TO_MS);
    nextRunAt = considerNextRun(nextRunAt, fallback, now);
  }

  const finalNextRun = nextRunAt ?? new Date(nowTime + DEFAULT_REEVALUATE_HOURS * HOURS_TO_MS);

  return {
    due,
    snoozed,
    nextRunAt: finalNextRun,
    threshold,
    snoozeHours: config.snoozeHours,
  };
}

export function markRemindersSent(
  reminders: Iterable<Pick<ReminderJob, "friendId">>,
  timestamp: Date | string = new Date()
): void {
  const when = ensureDate(timestamp, new Date());
  for (const reminder of reminders) {
    if (!reminder || typeof reminder.friendId !== "string") continue;
    recordReminderSent(reminder.friendId, when);
  }
}
