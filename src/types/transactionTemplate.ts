import type { TransactionParticipant } from "./transaction";

export type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

export interface TransactionTemplateRecurrence {
  frequency: RecurrenceFrequency;
  nextOccurrence: string;
  reminderDaysBefore?: number | null;
}

export interface TransactionTemplate {
  id: string;
  name: string;
  total: number;
  payer: string;
  category: string;
  note: string | null;
  participants: TransactionParticipant[];
  createdAt: string;
  updatedAt: string | null;
  recurrence?: TransactionTemplateRecurrence | null;
}

export interface SplitDraftPreset {
  id: string;
  templateId?: string | null;
  templateName?: string | null;
  total: number;
  payer: string;
  category: string;
  note: string;
  participants: TransactionParticipant[];
  recurrence?: TransactionTemplateRecurrence | null;
}
