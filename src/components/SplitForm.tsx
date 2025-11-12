import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";
import { CATEGORIES } from "../lib/categories";
import { formatEUR, roundToCents } from "../lib/money";
import { buildSplitTransaction } from "../lib/transactions";
import type { LegacyFriend } from "../types/legacySnapshot";
import type { SplitDraftPreset } from "../types/transactionTemplate";

const YOU_ID = "you";

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
] as const;

type FrequencyValue = (typeof FREQUENCY_OPTIONS)[number]["value"];

interface Participant {
  id: string;
  amount: string;
}

interface DraftParticipant {
  id: string;
  amount?: number | string;
}

interface DraftTransaction {
  id: string;
  templateId?: string;
  templateName?: string;
  total?: number;
  payer?: string;
  category?: string;
  note?: string;
  participants?: DraftParticipant[];
  recurrence?: {
    frequency: FrequencyValue;
    nextOccurrence: string;
    reminderDaysBefore?: number | null;
  };
}

interface AutomationRequest {
  template: {
    templateId: string | null;
    name: string;
    recurrence: {
      frequency: FrequencyValue;
      nextOccurrence: string;
      reminderDaysBefore: number | null;
    } | null;
  };
}

interface TemplateIntent {
  mode: "template" | "recurring";
  includeSplit: boolean;
}

interface NormalizedParticipant {
  id: string;
  amount: number;
}

interface SplitFormProps {
  friends: LegacyFriend[];
  defaultFriendId?: string | null;
  onSplit: (transaction: ReturnType<typeof buildSplitTransaction>) => void;
  onAutomation?: (
    transaction: ReturnType<typeof buildSplitTransaction>,
    automation: AutomationRequest
  ) => void;
  onRequestTemplate?: (
    transaction: ReturnType<typeof buildSplitTransaction>,
    intent: TemplateIntent
  ) => void;
  draft?: DraftTransaction | SplitDraftPreset | null;
  resetSignal?: number;
}

function formatParticipantAmount(amount: unknown): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return numeric.toFixed(2);
}

function normalizeDraftParticipants(
  entries: DraftParticipant[] = []
): Participant[] {
  const seen = new Set<string>();
  const mapped: Participant[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string") continue;
    const id = entry.id.trim();
    if (!id || seen.has(id)) continue;
    mapped.push({ id, amount: formatParticipantAmount(entry.amount) });
    seen.add(id);
  }
  if (!seen.has(YOU_ID)) {
    mapped.unshift({ id: YOU_ID, amount: "" });
  }
  return mapped;
}

function createDefaultParticipants(
  defaultFriendId?: string | null
): Participant[] {
  const initial: Participant[] = [{ id: YOU_ID, amount: "" }];
  if (defaultFriendId) {
    initial.push({ id: defaultFriendId, amount: "" });
  }
  return initial;
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "object")
    return null;
  const str =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const trimmed = str.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return roundToCents(num);
}

export default function SplitForm({
  friends,
  defaultFriendId,
  onSplit,
  onAutomation,
  onRequestTemplate,
  draft,
  resetSignal,
}: SplitFormProps) {
  const [bill, setBill] = useState("");
  const [payer, setPayer] = useState(YOU_ID);
  const [category, setCategory] = useState("Other");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState<Participant[]>(() =>
    createDefaultParticipants(defaultFriendId)
  );
  const [addFriendId, setAddFriendId] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [scheduleRecurring, setScheduleRecurring] = useState(false);
  const [frequency, setFrequency] = useState<FrequencyValue>("monthly");
  const [nextOccurrence, setNextOccurrence] = useState("");
  const [reminderDays, setReminderDays] = useState("2");

  const errorId = useMemo(
    () => `split-form-error-${Math.random().toString(36).slice(2)}`,
    []
  );

  const friendsById = useMemo(() => {
    const map = new Map<string, LegacyFriend>();
    for (const f of friends) {
      map.set(f.id, f);
    }
    return map;
  }, [friends]);

  const participantIds = useMemo(
    () => new Set(participants.map((p) => p.id)),
    [participants]
  );

  const friendParticipants = useMemo(
    () => participants.filter((p) => p.id !== YOU_ID),
    [participants]
  );

  useEffect(() => {
    if (!draft) return;
    setBill(draft.total ? String(draft.total) : "");
    setCategory(draft.category || "Other");
    setPayer(draft.payer || YOU_ID);
    setNote(draft.note || "");
    setParticipants(normalizeDraftParticipants(draft.participants));
    setError("");
    setAddFriendId("");
  }, [draft]);

  useEffect(() => {
    if (draft) return;
    setBill("");
    setCategory("Other");
    setPayer(YOU_ID);
    setNote("");
    setParticipants(createDefaultParticipants(defaultFriendId));
    setError("");
    setAddFriendId("");
  }, [defaultFriendId, resetSignal, draft]);

  const selectableFriends = useMemo(
    () => friends.filter((f) => !participantIds.has(f.id)),
    [friends, participantIds]
  );

  const totalNumber = useMemo(() => {
    const parsed = Number(bill);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return roundToCents(parsed);
  }, [bill]);

  const totalParticipants = participants.length;
  const sumOfInputs = useMemo(() => {
    let sum = 0;
    for (const p of participants) {
      const parsed = parseAmount(p.amount);
      if (parsed !== null) sum += parsed;
    }
    return roundToCents(sum);
  }, [participants]);

  const canSplitEvenly = totalNumber !== null && totalParticipants > 0;

  function updateParticipant(id: string, value: string): void {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, amount: value } : p))
    );
  }

  function removeParticipant(id: string): void {
    if (id === YOU_ID) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setPayer((prev) => (prev === id ? YOU_ID : prev));
  }

  function addParticipant(id: string): void {
    if (!id || participantIds.has(id)) return;
    setParticipants((prev) => [...prev, { id, amount: "" }]);
    setAddFriendId("");
  }

  function handleAddFriend(e: ChangeEvent<HTMLSelectElement>): void {
    const id = e.target.value;
    if (!id) return;
    addParticipant(id);
  }

  function splitEvenly(): void {
    if (!canSplitEvenly || totalNumber === null) return;
    setParticipants((prev) => {
      const parsedPrev = prev.map((p) => {
        const value = parseAmount(p.amount);
        return {
          id: p.id,
          cents: value === null ? null : Math.round(value * 100),
        };
      });

      const totalCents = Math.round(totalNumber * 100);
      const lockedSumCents = parsedPrev.reduce(
        (acc, p) => acc + (p.cents ?? 0),
        0
      );

      const editableCount = parsedPrev.reduce(
        (count, p) => (p.cents === null ? count + 1 : count),
        0
      );

      const remainingCents = totalCents - lockedSumCents;
      if (editableCount === 0 || remainingCents < 0) {
        return prev;
      }

      const perPerson = Math.floor(remainingCents / editableCount);
      let remainder = remainingCents - perPerson * editableCount;

      return prev.map((p, index) => {
        if (parsedPrev[index].cents !== null) {
          return p;
        }
        const extra = remainder > 0 ? 1 : 0;
        if (remainder > 0) {
          remainder -= 1;
        }
        const cents = perPerson + extra;
        return { ...p, amount: (cents / 100).toFixed(2) };
      });
    });
  }

  function normalizeParticipants(
    total: number
  ): NormalizedParticipant[] | null {
    const rawYou = participants.find((p) => p.id === YOU_ID);
    const youAmountInput = parseAmount(rawYou?.amount ?? "");
    const friendEntries = friendParticipants;

    if (friendEntries.length === 0) {
      setError("Add at least one friend to split the bill.");
      return null;
    }

    const friendParts: NormalizedParticipant[] = friendEntries.map((p) => ({
      id: p.id,
      amount: parseAmount(p.amount) ?? 0,
    }));

    const friendTotal = roundToCents(
      friendParts.reduce((acc, p) => acc + (p.amount || 0), 0)
    );

    let yourShare: number;
    if (youAmountInput !== null) {
      yourShare = youAmountInput;
    } else {
      yourShare = roundToCents(total - friendTotal);
    }

    if (yourShare < 0) {
      setError("Friend shares exceed the total amount.");
      return null;
    }

    const sum = roundToCents(friendTotal + yourShare);
    if (Math.abs(sum - total) > 0.01) {
      setError("Shares must add up to the total bill.");
      return null;
    }

    return [{ id: YOU_ID, amount: yourShare }, ...friendParts];
  }

  function buildTransactionPayload(
    rawTotal: number,
    normalizedParticipants: NormalizedParticipant[]
  ): {
    transaction: ReturnType<typeof buildSplitTransaction>;
    automationRequest: AutomationRequest | null;
  } | null {
    const friendIds = normalizedParticipants
      .map((p) => p.id)
      .filter((id) => id !== YOU_ID);

    if (friendIds.length === 0) {
      setError("Add at least one friend to split the bill.");
      return null;
    }

    const allowedPayers = new Set([YOU_ID, ...friendIds]);
    let nextPayer = payer;
    if (!allowedPayers.has(nextPayer)) {
      nextPayer = YOU_ID;
    }

    let automationRequest: AutomationRequest | null = null;
    if (saveAsTemplate || scheduleRecurring) {
      const trimmedName = templateName.trim();
      if (!trimmedName) {
        setError("Name your template to save it for later.");
        return null;
      }
      let recurrence: {
        frequency: FrequencyValue;
        nextOccurrence: string;
        reminderDaysBefore: number | null;
      } | null = null;
      if (scheduleRecurring) {
        const dateValue = nextOccurrence.trim();
        if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateValue)) {
          setError("Select the next occurrence date.");
          return null;
        }
        const parsedReminder = Number(reminderDays);
        const reminderDaysBefore =
          Number.isFinite(parsedReminder) && parsedReminder >= 0
            ? Math.floor(parsedReminder)
            : null;
        recurrence = {
          frequency,
          nextOccurrence: dateValue,
          reminderDaysBefore,
        };
      }
      automationRequest = {
        template: {
          templateId: draft?.templateId ?? null,
          name: trimmedName,
          recurrence,
        },
      };
    }

    const transaction = buildSplitTransaction({
      total: rawTotal,
      payer: nextPayer,
      participants: normalizedParticipants,
      category,
      note: note.trim(),
      templateId: automationRequest?.template?.templateId ?? undefined,
      templateName: automationRequest?.template?.name ?? undefined,
    });

    if (draft?.templateId) {
      transaction.templateId = draft.templateId;
    }
    if (draft?.templateName) {
      transaction.templateName = draft.templateName;
    }

    return { transaction, automationRequest };
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError("");

    const rawTotal = parseAmount(bill);
    if (rawTotal === null || rawTotal <= 0) {
      setError("Enter a valid total amount.");
      return;
    }

    const normalizedParticipants = normalizeParticipants(rawTotal);
    if (!normalizedParticipants) return;

    const payload = buildTransactionPayload(rawTotal, normalizedParticipants);
    if (!payload) return;

    const { transaction, automationRequest } = payload;

    onSplit(transaction);
    if (automationRequest && typeof onAutomation === "function") {
      onAutomation(transaction, automationRequest);
    }

    setBill("");
    setNote("");
    setCategory("Other");
    setPayer(YOU_ID);
    setParticipants(createDefaultParticipants(defaultFriendId));
    setAddFriendId("");
    setError("");
    setSaveAsTemplate(false);
    setTemplateName("");
    setScheduleRecurring(false);
    setFrequency("monthly");
    setNextOccurrence("");
    setReminderDays("2");
  }

  function handleRequestTemplate(intent: TemplateIntent): void {
    if (!onRequestTemplate) return;
    setError("");

    const rawTotal = parseAmount(bill);
    if (rawTotal === null || rawTotal <= 0) {
      setError("Enter a valid total amount before saving a template.");
      return;
    }

    const normalizedParticipants = normalizeParticipants(rawTotal);
    if (!normalizedParticipants) return;

    const payload = buildTransactionPayload(rawTotal, normalizedParticipants);
    if (!payload) return;

    const { transaction } = payload;

    onRequestTemplate(transaction, intent);
  }

  return (
    <form onSubmit={handleSubmit} className="list list-gap-md">
      <div>
        <label className="kicker" htmlFor="bill">
          Total bill amount (€)
        </label>
        <input
          id="bill"
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={bill}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setBill(e.target.value)
          }
          placeholder="e.g. 120.50"
          required
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : undefined}
        />
        {totalNumber !== null && (
          <div className="helper">Total: {formatEUR(totalNumber)}</div>
        )}
      </div>

      <div>
        <div className="participants-heading">
          <div>
            <div className="fw-600">Participants</div>
            <div className="helper">
              Enter how much each person is covering in euros.
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={splitEvenly}
            disabled={!canSplitEvenly}
          >
            Split evenly
          </button>
        </div>

        <div className="participants-grid">
          {participants.map((p) => {
            const friend = friendsById.get(p.id);
            const label =
              p.id === YOU_ID ? "You" : friend ? friend.name : "Unknown";
            const subtitle =
              p.id === YOU_ID
                ? "Leave blank to cover whatever remains"
                : friend?.email;
            const inputId = `participant-${p.id}`;
            return (
              <div key={p.id} className="participant-card">
                <div className="participant-header">
                  <div>
                    <div className="fw-600">{label}</div>
                    {subtitle && <div className="kicker">{subtitle}</div>}
                  </div>
                  {p.id !== YOU_ID && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removeParticipant(p.id)}
                      title="Remove from this split"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="participant-input">
                  <label className="kicker" htmlFor={inputId}>
                    {p.id === YOU_ID
                      ? "Your share (€)"
                      : `${label}'s share (€)`}
                  </label>
                  <input
                    id={inputId}
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.amount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateParticipant(p.id, e.target.value)
                    }
                    placeholder={p.id === YOU_ID ? "auto" : "0.00"}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {selectableFriends.length > 0 && (
          <div className="add-participant">
            <label className="kicker" htmlFor="add-participant">
              Add another person
            </label>
            <select
              id="add-participant"
              className="select"
              value={addFriendId}
              onChange={handleAddFriend}
            >
              <option value="">Select a friend</option>
              {selectableFriends.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {totalNumber !== null && (
          <div className="helper participants-helper">
            Make sure everyone's shares add up to {formatEUR(totalNumber)}.
            Current sum: {formatEUR(sumOfInputs)}
          </div>
        )}
      </div>

      <div>
        <label className="kicker">Who paid the bill?</label>
        <select
          className="select"
          value={payer}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setPayer(e.target.value)
          }
        >
          <option value={YOU_ID}>You</option>
          {participants
            .filter((p) => p.id !== YOU_ID)
            .map((p) => {
              const friend = friendsById.get(p.id);
              return (
                <option key={p.id} value={p.id}>
                  {friend ? friend.name : "Friend"}
                </option>
              );
            })}
        </select>
      </div>

      <div>
        <label className="kicker" htmlFor="category">
          Category
        </label>
        <select
          id="category"
          className="select"
          value={category}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setCategory(e.target.value)
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="kicker" htmlFor="note">
          Note
        </label>
        <textarea
          id="note"
          className="input"
          rows={2}
          value={note}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setNote(e.target.value)
          }
          placeholder="Optional description"
        />
      </div>

      <div className="card stack-sm">
        <div>
          <div className="fw-600">Automation</div>
          <div className="kicker">
            Save this split for quick reuse or schedule it on a cadence.
          </div>
        </div>

        <label className="row gap-8 align-center" htmlFor="template-toggle">
          <input
            id="template-toggle"
            type="checkbox"
            checked={saveAsTemplate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const checked = e.target.checked;
              setSaveAsTemplate(checked);
              if (!checked) {
                setScheduleRecurring(false);
              }
            }}
          />
          <span>Save as a reusable template</span>
        </label>

        <label className="row gap-8 align-center" htmlFor="recurring-toggle">
          <input
            id="recurring-toggle"
            type="checkbox"
            checked={scheduleRecurring}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const checked = e.target.checked;
              setScheduleRecurring(checked);
              if (checked) {
                setSaveAsTemplate(true);
              }
            }}
          />
          <span>Mark as a recurring expense</span>
        </label>

        {(saveAsTemplate || scheduleRecurring) && (
          <div>
            <label className="kicker" htmlFor="template-name">
              Template name
            </label>
            <input
              id="template-name"
              className="input"
              value={templateName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setTemplateName(e.target.value)
              }
              placeholder="e.g. Monthly rent with Alex"
            />
          </div>
        )}

        {scheduleRecurring && (
          <div className="list list-gap-sm">
            <div>
              <label className="kicker" htmlFor="recurrence-frequency">
                Frequency
              </label>
              <select
                id="recurrence-frequency"
                className="select"
                value={frequency}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setFrequency(e.target.value as FrequencyValue)
                }
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="kicker" htmlFor="recurrence-date">
                Next occurrence
              </label>
              <input
                id="recurrence-date"
                className="input"
                type="date"
                value={nextOccurrence}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setNextOccurrence(e.target.value)
                }
              />
            </div>

            <div>
              <label className="kicker" htmlFor="recurrence-reminder">
                Reminder (days before)
              </label>
              <input
                id="recurrence-reminder"
                className="input"
                type="number"
                min="0"
                value={reminderDays}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setReminderDays(e.target.value)
                }
              />
            </div>

            <div className="helper">
              Recurring templates appear above with a "Generate now" button when
              they're due.
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error" id={errorId} role="alert">
          {error}
        </div>
      )}

      <div className="row gap-8 flex-wrap">
        <button className="button" type="submit">
          Save split
        </button>
        {onRequestTemplate && (
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                handleRequestTemplate({ mode: "template", includeSplit: true })
              }
            >
              Save split & template
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                handleRequestTemplate({ mode: "recurring", includeSplit: true })
              }
            >
              Schedule recurring split
            </button>
          </>
        )}
      </div>
    </form>
  );
}
