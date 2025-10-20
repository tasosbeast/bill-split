export type TransactionType =
  | "split"
  | "settlement"
  | (string & Record<never, never>);

export interface TransactionParticipant {
  id: string;
  amount: number;
}

export interface TransactionEffect {
  friendId: string;
  share: number;
  delta: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  total: number | null;
  category?: string | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  payer?: string | null;
  participants?: TransactionParticipant[] | null;
  effects?: TransactionEffect[] | null;
  friendId?: string | null;
  friendIds?: string[] | null;
  templateId?: string | null;
  templateName?: string | null;
}
