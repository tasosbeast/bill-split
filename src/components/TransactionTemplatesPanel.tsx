import { memo, useMemo, type ReactElement } from "react";
import type { TransactionTemplate } from "../types/transactionTemplate";
import { formatEUR } from "../lib/money";

interface TransactionTemplatesPanelProps {
  templates: TransactionTemplate[];
  onUseTemplate: (template: TransactionTemplate) => void;
  onGenerateRecurring: (template: TransactionTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
}

interface TemplateRenderEntry {
  template: TransactionTemplate;
  isRecurring: boolean;
  nextOccurrenceLabel: string | null;
  statusLabel: string | null;
  statusTone: "positive" | "warning" | "neutral";
}

function parseDate(dateString: string): number | null {
  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month, day));
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function formatDate(dateString: string): string {
  const time = parseDate(dateString);
  if (time === null) return dateString;
  const date = new Date(time);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildRenderEntries(
  templates: TransactionTemplate[]
): TemplateRenderEntry[] {
  const now = Date.now();
  return templates.map((template) => {
    const recurrence = template.recurrence;
    if (!recurrence) {
      return {
        template,
        isRecurring: false,
        nextOccurrenceLabel: null,
        statusLabel: null,
        statusTone: "neutral",
      } satisfies TemplateRenderEntry;
    }
    const nextTime = parseDate(recurrence.nextOccurrence);
    const nextOccurrenceLabel = formatDate(recurrence.nextOccurrence);
    let statusLabel: string | null = null;
    let statusTone: TemplateRenderEntry["statusTone"] = "neutral";
    if (nextTime !== null) {
      if (nextTime <= now) {
        statusLabel = "Due";
        statusTone = "warning";
      } else if (
        typeof recurrence.reminderDaysBefore === "number" &&
        recurrence.reminderDaysBefore >= 0
      ) {
        const reminderTime =
          nextTime - recurrence.reminderDaysBefore * 24 * 60 * 60 * 1000;
        if (now >= reminderTime) {
          statusLabel = `Reminder window (${recurrence.reminderDaysBefore}d)`;
          statusTone = "positive";
        }
      }
    }
    return {
      template,
      isRecurring: true,
      nextOccurrenceLabel,
      statusLabel,
      statusTone,
    } satisfies TemplateRenderEntry;
  });
}

function TransactionTemplatesPanel({
  templates,
  onUseTemplate,
  onGenerateRecurring,
  onDeleteTemplate,
}: TransactionTemplatesPanelProps): ReactElement | null {
  const entries = useMemo(() => buildRenderEntries(templates), [templates]);
  if (entries.length === 0) {
    return null;
  }

  const recurring = entries.filter((entry) => entry.isRecurring);
  const standard = entries.filter((entry) => !entry.isRecurring);

  return (
    <div className="stack-md" aria-live="polite">
      {recurring.length > 0 && (
        <section className="card stack-sm">
          <header className="row justify-between align-center">
            <h3 className="fw-600">Recurring schedules</h3>
            <span className="kicker">Generate rent, utilities, and subs right on time.</span>
          </header>
          <div className="list stack-sm">
            {recurring.map(({ template, nextOccurrenceLabel, statusLabel, statusTone }) => (
              <div key={template.id} className="list-item stack-sm">
                <div className="row justify-between">
                  <div className="stack-xs">
                    <div className="fw-600">{template.name}</div>
                    <div className="kicker">
                      Next: {nextOccurrenceLabel}
                      {statusLabel && (
                        <>
                          {" · "}
                          <span
                            className={`pill ${
                              statusTone === "warning"
                                ? "pill-neg"
                                : statusTone === "positive"
                                ? "pill-pos"
                                : "pill-zero"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="tx-badges">
                      <span className="badge-chip">
                        <strong>Category</strong> {template.category}
                      </span>
                      <span className="badge-chip">
                        <strong>Total</strong> {formatEUR(template.total)}
                      </span>
                    </div>
                  </div>
                  <div className="row gap-8">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onUseTemplate(template)}
                    >
                      Use template
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => onGenerateRecurring(template)}
                    >
                      Generate now
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onDeleteTemplate(template.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {standard.length > 0 && (
        <section className="card stack-sm">
          <header className="row justify-between align-center">
            <h3 className="fw-600">Saved templates</h3>
            <span className="kicker">Prefill splits for weekly dinners or shared errands.</span>
          </header>
          <div className="list stack-sm">
            {standard.map(({ template }) => (
              <div key={template.id} className="list-item row justify-between align-center">
                <div className="stack-xs">
                  <div className="fw-600">{template.name}</div>
                  <div className="tx-badges">
                    <span className="badge-chip">
                      <strong>Category</strong> {template.category}
                    </span>
                    <span className="badge-chip">
                      <strong>Total</strong> {formatEUR(template.total)}
                    </span>
                  </div>
                </div>
                <div className="row gap-8">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onUseTemplate(template)}
                  >
                    Use template
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onDeleteTemplate(template.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default memo(TransactionTemplatesPanel);
