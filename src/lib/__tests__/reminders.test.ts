import { describe, it, beforeEach, afterAll, expect } from "vitest";
import { evaluateReminders, markRemindersSent } from "../reminders";
import {
  clearReminderHistory,
  getRemindersState,
  recordReminderSent,
  resetRemindersState,
  setReminderPreferences,
  setRemindersStorage,
} from "../../state/remindersStore";
import { createMemoryStorage } from "../../state/persistence";

describe("reminder engine", () => {
  beforeEach(() => {
    setRemindersStorage(createMemoryStorage());
    resetRemindersState();
    clearReminderHistory();
  });

  afterAll(() => {
    setRemindersStorage(null);
    resetRemindersState();
  });

  it("flags balances that cross the configured threshold", () => {
    setReminderPreferences({ threshold: 20, snoozeHours: 24 });
    const now = new Date("2024-04-01T10:00:00.000Z");

    const result = evaluateReminders(
      [
        { friendId: "alex", balance: 35.5 },
        { friendId: "sam", balance: -12 },
      ],
      now
    );

    expect(result.due).toHaveLength(1);
    expect(result.due[0]).toMatchObject({
      friendId: "alex",
      balance: 35.5,
      overdueBy: 15.5,
      channels: getRemindersState().channels,
    });
    expect(result.nextRunAt.toISOString()).toBe(
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("ignores balances that stay below the threshold", () => {
    setReminderPreferences({ threshold: 50 });
    const now = new Date("2024-04-01T12:00:00.000Z");
    const result = evaluateReminders(
      [
        { friendId: "sam", balance: 25 },
        { friendId: "mia", balance: 49.99 },
      ],
      now
    );

    expect(result.due).toHaveLength(0);
    expect(result.snoozed).toHaveLength(0);
    expect(result.nextRunAt.toISOString()).toBe(
      new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
    );
  });

  it("respects the snooze window when reminders were already sent", () => {
    setReminderPreferences({ threshold: 10, snoozeHours: 48 });
    recordReminderSent("alex", new Date("2024-04-01T12:00:00.000Z"));

    const now = new Date("2024-04-02T09:00:00.000Z");
    const result = evaluateReminders([{ friendId: "alex", balance: 30 }], now);

    expect(result.due).toHaveLength(0);
    expect(result.snoozed).toHaveLength(1);
    expect(result.snoozed[0].retryAt.toISOString()).toBe(
      "2024-04-03T12:00:00.000Z"
    );
    expect(result.nextRunAt.toISOString()).toBe(
      result.snoozed[0].retryAt.toISOString()
    );
  });

  it("updates reminder history once notifications are marked as sent", () => {
    setReminderPreferences({ threshold: 10, snoozeHours: 24 });
    const now = new Date("2024-04-04T10:00:00.000Z");

    const evaluation = evaluateReminders(
      [
        { friendId: "mia", balance: 18.25 },
        { friendId: "alex", balance: 3 },
      ],
      now
    );

    expect(evaluation.due).toHaveLength(1);
    markRemindersSent(evaluation.due, now);

    const state = getRemindersState();
    expect(state.lastSent.mia).toBe(now.toISOString());

    const followUp = evaluateReminders(
      [{ friendId: "mia", balance: 18.25 }],
      new Date("2024-04-04T18:00:00.000Z")
    );

    expect(followUp.due).toHaveLength(0);
    expect(followUp.snoozed).toHaveLength(1);
  });
});
