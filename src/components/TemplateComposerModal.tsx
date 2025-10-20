import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type MutableRefObject,
} from "react";
import Modal from "./Modal";
import { formatEUR, roundToCents } from "../lib/money";
import type { StoredTransaction } from "../types/legacySnapshot";
import type { SplitAutomationRequest } from "../hooks/useTransactionTemplates";
import type {
  RecurrenceFrequency,
  TransactionTemplateRecurrence,
} from "../types/transactionTemplate";

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
];

function isRecurrenceFrequency(value: string): value is RecurrenceFrequency {
  return value === "monthly" || value === "weekly" || value === "yearly";
}

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface TemplateComposerIntent {
  mode: "template" | "recurring";
  includeSplit: boolean;
}

interface TemplateComposerModalProps {
  transaction: StoredTransaction;
  intent: TemplateComposerIntent;
  onClose: () => void;
  onSave: (automation: SplitAutomationRequest) => void;
}

interface ModalRenderProps {
  firstFieldRef: MutableRefObject<HTMLInputElement | null>;
}

export default function TemplateComposerModal({
  transaction,
  intent,
  onClose,
  onSave,
}: TemplateComposerModalProps) {
  const defaultName = useMemo(() => {
    if (typeof transaction.templateName === "string" && transaction.templateName.trim()) {
      return transaction.templateName.trim();
    }
    if (typeof transaction.note === "string" && transaction.note.trim()) {
      return transaction.note.trim();
    }
    const category =
      typeof transaction.category === "string" && transaction.category.trim()
        ? transaction.category.trim()
        : "Split";
    return `${category} split`;
  }, [transaction.templateName, transaction.note, transaction.category]);

  const [templateName, setTemplateName] = useState(defaultName);
  const [includeRecurring, setIncludeRecurring] = useState(
    intent.mode === "recurring"
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [nextOccurrence, setNextOccurrence] = useState("");
  const [reminderDays, setReminderDays] = useState("2");
  const [error, setError] = useState("");

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTemplateName(event.target.value);
  };

  const handleIncludeRecurringChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setIncludeRecurring(event.target.checked);
  };

  const handleFrequencyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    if (isRecurrenceFrequency(nextValue)) {
      setFrequency(nextValue);
    }
  };

  const handleNextOccurrenceChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNextOccurrence(event.target.value);
  };

  const handleReminderDaysChange = (event: ChangeEvent<HTMLInputElement>) => {
    setReminderDays(event.target.value);
  };

  useEffect(() => {
    setTemplateName(defaultName);
    setIncludeRecurring(intent.mode === "recurring");
    const recurrence = transaction.recurrence as
      | TransactionTemplateRecurrence
      | undefined
      | null;
    if (recurrence) {
      setFrequency(recurrence.frequency);
      setNextOccurrence(recurrence.nextOccurrence);
      setReminderDays(
        recurrence.reminderDaysBefore !== undefined && recurrence.reminderDaysBefore !== null
          ? String(recurrence.reminderDaysBefore)
          : "2"
      );
    } else {
      setFrequency("monthly");
      setNextOccurrence("");
      setReminderDays("2");
    }
    setError("");
  }, [defaultName, intent.mode, transaction.recurrence]);

  useEffect(() => {
    if (includeRecurring && !nextOccurrence) {
      setNextOccurrence(todayIso());
    }
  }, [includeRecurring, nextOccurrence]);

  useEffect(() => {
    if (!templateName.trim()) {
      setTemplateName(defaultName);
    }
  }, [defaultName, templateName]);

  const total = roundToCents(transaction.total ?? 0);
  const participantCount = Array.isArray(transaction.participants)
    ? transaction.participants.length
    : 0;
  const splitSummary = `${formatEUR(total)} total • ${participantCount} participant${
    participantCount === 1 ? "" : "s"
  }`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = templateName.trim();
    if (!trimmedName) {
      setError("Name your template to save it for later.");
      return;
    }

    let recurrence: TransactionTemplateRecurrence | null = null;
    if (includeRecurring) {
      const dateValue = nextOccurrence.trim();
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateValue)) {
        setError("Select the next occurrence date.");
        return;
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

    const automation: SplitAutomationRequest = {
      template: {
        templateId:
          typeof transaction.templateId === "string"
            ? transaction.templateId
            : null,
        name: trimmedName,
        recurrence,
      },
    };

    onSave(automation);
  }

  return (
    <Modal
      title={includeRecurring ? "Schedule recurring split" : "Save template"}
      onClose={onClose}
    >
      {({ firstFieldRef }: ModalRenderProps) => (
        <form className="form-grid" onSubmit={handleSubmit}>
          <p className="kicker">
            Save this split as a reusable template. Your current amounts,
            participants, and category will be stored.
          </p>
          <p className="helper">{splitSummary}</p>

          <label className="kicker" htmlFor="template-name-input">
            Template name
          </label>
          <input
            id="template-name-input"
            ref={firstFieldRef}
            className="input"
            value={templateName}
            onChange={handleNameChange}
            placeholder="e.g. Monthly rent with Alex"
            autoComplete="off"
          />

          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeRecurring}
              onChange={handleIncludeRecurringChange}
            />
            <span>Mark as a recurring expense</span>
          </label>

          {includeRecurring && (
            <div className="list list-gap-sm">
              <div>
                <label className="kicker" htmlFor="template-frequency">
                  Frequency
                </label>
                <select
                  id="template-frequency"
                  className="select"
                  value={frequency}
                  onChange={handleFrequencyChange}
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="kicker" htmlFor="template-next">
                  Next occurrence
                </label>
                <input
                  id="template-next"
                  className="input"
                  type="date"
                  value={nextOccurrence}
                  onChange={handleNextOccurrenceChange}
                />
              </div>

              <div>
                <label className="kicker" htmlFor="template-reminder">
                  Reminder (days before)
                </label>
                <input
                  id="template-reminder"
                  className="input"
                  type="number"
                  min="0"
                  value={reminderDays}
                  onChange={handleReminderDaysChange}
                />
              </div>

              <p className="helper">
                Recurring templates appear with a “Generate now” button when
                they’re due.
              </p>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="row justify-end gap-8">
            <button type="button" className="button btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button">
              {includeRecurring ? "Save recurring template" : "Save template"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
