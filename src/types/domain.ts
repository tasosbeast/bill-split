export type Friend = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  active: boolean;
  createdAt: number;
  tag?: string;
};

export type TransactionStatus = "final" | "settlement";

export type Transaction = {
  id: string;
  payerId: string;
  participantIds: string[];
  amount: number;
  note?: string;
  createdAt: number;
  status: TransactionStatus;
};

export type SettlementLinkType = "revolut" | "paypal" | "bank";

export type SettlementLink = {
  type: SettlementLinkType;
  url: string;
};

export type Settlement = {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  status: "initiated" | "confirmed";
  createdAt: number;
  link?: SettlementLink;
};

