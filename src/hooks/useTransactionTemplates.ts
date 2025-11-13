import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { roundToCents } from "../lib/money";
import { buildSplitTransaction } from "../lib/transactions";
import type {
  StoredTransaction,
  StoredSnapshotTemplate,
} from "../types/legacySnapshot";
import type {
  TransactionTemplate,
  TransactionTemplateRecurrence,
  SplitDraftPreset,
  RecurrenceFrequency,
} from "../types/transactionTemplate";
import type { TransactionParticipant } from "../types/transaction";
import type { SnapshotUpdaters } from "./useSnapshot";

export interface SplitAutomationTemplateRequest {
  templateId?: string | null;
  name: string;
  recurrence?: TransactionTemplateRecurrence | null;
}

export interface SplitAutomationRequest {
  template?: SplitAutomationTemplateRequest | null;
}

let fallbackTemplateCounter = 0;

function generateTemplateId(): string {
  const cryptoRef =
    typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
      : undefined;

  if (typeof cryptoRef?.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }

  if (typeof cryptoRef?.getRandomValues === "function") {
    const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  fallbackTemplateCounter = (fallbackTemplateCounter + 1) & 0xffff;
  const timestamp = Date.now().toString(16).padStart(12, "0");
  const counter = fallbackTemplateCounter.toString(16).padStart(4, "0");
  return `template-${timestamp}${counter}`;
}

function cloneParticipants(
  participants: StoredTransaction["participants"] | undefined
): TransactionParticipant[] {
  if (!Array.isArray(participants)) return [];
  return participants.map((participant) => ({
    id: participant.id,
    amount: roundToCents(participant.amount ?? 0),
  }));
}

function templateFromTransaction(
  transaction: StoredTransaction,
  request: SplitAutomationTemplateRequest,
  existing?: TransactionTemplate | null
): TransactionTemplate {
  const timestamp = new Date().toISOString();
  const participants = cloneParticipants(transaction.participants);
  return {
    id: existing?.id ?? request.templateId ?? generateTemplateId(),
    name: request.name,
    total: roundToCents(transaction.total ?? 0),
    payer: transaction.payer ?? "you",
    category: transaction.category ?? "Other",
    note: transaction.note ?? null,
    participants,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: existing ? timestamp : null,
    recurrence: request.recurrence ?? null,
  };
}

function buildDraftFromTemplate(
  template: TransactionTemplate
): SplitDraftPreset {
  const participants = cloneParticipants(template.participants);
  return {
    id: `template-${template.id}-${template.updatedAt ?? template.createdAt}`,
    templateId: template.id,
    templateName: template.name,
    total: template.total,
    payer: template.payer,
    category: template.category,
    note: template.note ?? "",
    participants,
    recurrence: template.recurrence ?? null,
  };
}

function addInterval(
  dateString: string,
  frequency: RecurrenceFrequency
): string {
  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return dateString;
  }
  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  if (frequency === "weekly") {
    date.setUTCDate(date.getUTCDate() + 7);
  } else if (frequency === "monthly") {
    const originalDay = date.getUTCDate();
    date.setUTCMonth(date.getUTCMonth() + 1);
    if (date.getUTCDate() !== originalDay) {
      date.setUTCDate(0);
    }
  } else {
    const originalDay = date.getUTCDate();
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    if (date.getUTCDate() !== originalDay) {
      date.setUTCDate(0);
    }
  }
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function advanceNextOccurrence(
  recurrence: TransactionTemplateRecurrence
): TransactionTemplateRecurrence {
  return {
    ...recurrence,
    nextOccurrence: addInterval(
      recurrence.nextOccurrence,
      recurrence.frequency
    ),
  };
}

interface UseTransactionTemplatesParams {
  setTemplates: SnapshotUpdaters["setTemplates"];
  addTransaction: (transaction: StoredTransaction) => void;
  setDraftPreset?: Dispatch<SetStateAction<SplitDraftPreset | null>>;
}

export interface UseTransactionTemplatesResult {
  handleAutomation: (
    transaction: StoredTransaction,
    automation: SplitAutomationRequest | null
  ) => void;
  handleApplyTemplate: (template: TransactionTemplate) => void;
  handleDeleteTemplate: (templateId: string) => void;
  handleGenerateFromTemplate: (template: TransactionTemplate) => void;
}

export function useTransactionTemplates({
  setTemplates,
  addTransaction,
  setDraftPreset,
}: UseTransactionTemplatesParams): UseTransactionTemplatesResult {
  const handleAutomation = useCallback<
    UseTransactionTemplatesResult["handleAutomation"]
  >(
    (transaction, automation) => {
      if (!automation || !automation.template) return;
      const templateRequest = automation.template;
      setTemplates((prev) => {
        const existing = templateRequest.templateId
          ? prev.find((entry) => entry.id === templateRequest.templateId) ??
            null
          : null;
        const record = templateFromTransaction(
          transaction,
          templateRequest,
          existing
        );
        const next = [...prev];
        const index = next.findIndex((entry) => entry.id === record.id);
        if (index >= 0) {
          next[index] = record as StoredSnapshotTemplate;
        } else {
          next.unshift(record as StoredSnapshotTemplate);
        }
        return next;
      });
    },
    [setTemplates]
  );

  const handleApplyTemplate = useCallback<
    UseTransactionTemplatesResult["handleApplyTemplate"]
  >(
    (template) => {
      if (!setDraftPreset) return;
      setDraftPreset(buildDraftFromTemplate(template));
    },
    [setDraftPreset]
  );

  const handleDeleteTemplate = useCallback<
    UseTransactionTemplatesResult["handleDeleteTemplate"]
  >(
    (templateId) => {
      setTemplates((prev) => prev.filter((entry) => entry.id !== templateId));
      if (setDraftPreset) {
        setDraftPreset((prev) =>
          prev?.templateId === templateId ? null : prev
        );
      }
    },
    [setTemplates, setDraftPreset]
  );

  const handleGenerateFromTemplate = useCallback<
    UseTransactionTemplatesResult["handleGenerateFromTemplate"]
  >(
    (template) => {
      const transaction = buildSplitTransaction({
        total: template.total,
        payer: template.payer,
        participants: template.participants,
        category: template.category,
        note: template.note ?? template.name,
        templateId: template.id,
        templateName: template.name,
      }) as StoredTransaction;
      addTransaction(transaction);
      if (template.recurrence) {
        const nextRecurrence = advanceNextOccurrence(template.recurrence);
        setTemplates((prev) =>
          prev.map((entry) =>
            entry.id === template.id
              ? { ...entry, recurrence: nextRecurrence }
              : entry
          )
        );
      }
    },
    [addTransaction, setTemplates]
  );

  return {
    handleAutomation,
    handleApplyTemplate,
    handleDeleteTemplate,
    handleGenerateFromTemplate,
  };
}

export { buildDraftFromTemplate };
