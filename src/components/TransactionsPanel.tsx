import { memo, Suspense, lazy } from "react";
import type { Friend, StoredTransaction } from "../types/legacySnapshot";
import type { Transaction } from "../types/transaction";
import type {
  TransactionTemplate,
  SplitDraftPreset,
} from "../types/transactionTemplate";
import type { SplitAutomationRequest } from "../hooks/useTransactionTemplates";
import TransactionTemplatesPanel from "./TransactionTemplatesPanel";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";

const SplitForm = lazy(() => import("./SplitForm"));
const Transactions = lazy(() => import("./Transactions"));

interface FriendTransaction extends StoredTransaction {
  effect?: {
    friendId: string;
    delta: number;
    share: number;
  } | null;
}

interface TransactionsPanelProps {
  friends: Friend[];
  selectedFriend: Friend | null;
  selectedBalance: number;
  friendsById: Map<string, Friend>;
  transactions: FriendTransaction[];
  txFilter: string;
  categories: string[];
  onSplit: (transaction: StoredTransaction) => void;
  onAutomation?: (
    transaction: StoredTransaction,
    automation: SplitAutomationRequest | null
  ) => void;
  onOpenSettlement: () => void;
  onFilterChange: (value: string) => void;
  onClearFilter: () => void;
  onRequestEdit: (transaction: FriendTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onConfirmSettlement: (transactionId: string) => void;
  onCancelSettlement: (transactionId: string) => void;
  onReopenSettlement: (transactionId: string) => void;
  templates: TransactionTemplate[];
  onUseTemplate: (template: TransactionTemplate) => void;
  onGenerateRecurring: (template: TransactionTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  draft: SplitDraftPreset | null;
  onRequestTemplate: (
    transaction: StoredTransaction,
    intent: { mode: "template" | "recurring"; includeSplit: boolean }
  ) => void;
  splitFormResetSignal: number;
}

function formatCurrency(value: number): string {
  return Math.abs(value).toLocaleString(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function TransactionsPanel({
  friends,
  selectedFriend,
  selectedBalance,
  friendsById,
  transactions,
  txFilter,
  categories,
  onSplit,
  onAutomation,
  onOpenSettlement,
  onFilterChange,
  onClearFilter,
  onRequestEdit,
  onDeleteTransaction,
  onConfirmSettlement,
  onCancelSettlement,
  onReopenSettlement,
  templates,
  onUseTemplate,
  onGenerateRecurring,
  onDeleteTemplate,
  draft,
  onRequestTemplate,
  splitFormResetSignal,
}: TransactionsPanelProps) {
  const handleFilterChange = useDebouncedCallback(onFilterChange, 200);

  return (
    <section className="panel">
      <h2>Split a bill</h2>

      {!selectedFriend ? (
        <p className="kicker">Choose a friend to start.</p>
      ) : (
        <>
          <div className="row justify-between stack-sm">
            <div className="row">
              <div className="kicker">
                Splitting with <strong>{selectedFriend.name}</strong>
              </div>
              <span
                className={
                  selectedBalance > 0
                    ? "pill pill-pos"
                    : selectedBalance < 0
                    ? "pill pill-neg"
                    : "pill pill-zero"
                }
                title={
                  selectedBalance > 0
                    ? `${selectedFriend.name} owes you`
                    : selectedBalance < 0
                    ? `You owe ${selectedFriend.name}`
                    : "Settled"
                }
              >
                {selectedBalance > 0
                  ? "\u2191"
                  : selectedBalance < 0
                  ? "\u2193"
                  : "\u2014"}{" "}
                {formatCurrency(selectedBalance)}
              </span>
            </div>

            {selectedBalance !== 0 && (
              <button
                className="button btn-ghost"
                onClick={onOpenSettlement}
                title="Open the settlement assistant"
              >
                Record settlement
              </button>
            )}
          </div>

          <TransactionTemplatesPanel
            templates={templates}
            onUseTemplate={onUseTemplate}
            onGenerateRecurring={onGenerateRecurring}
            onDeleteTemplate={onDeleteTemplate}
          />

          <Suspense
            fallback={
              <div className="kicker" aria-live="polite">
                Loading split form…
              </div>
            }
          >
            <SplitForm
              friends={friends}
              defaultFriendId={selectedFriend.id}
              onSplit={onSplit}
              onAutomation={onAutomation}
              onRequestTemplate={onRequestTemplate}
              draft={draft ?? undefined}
              resetSignal={splitFormResetSignal}
            />
          </Suspense>

          <div className="spacer-md" aria-hidden="true" />
          <div className="row justify-between">
            <h2>Transactions</h2>
            <div className="row gap-8">
              <select
                className="select w-180"
                value={txFilter}
                onChange={(event) => handleFilterChange(event.target.value)}
                title="Filter by category"
              >
                <option value="All">All</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {txFilter !== "All" && (
                <button className="btn-ghost" onClick={onClearFilter}>
                  Clear filter
                </button>
              )}
            </div>
          </div>
          <Suspense
            fallback={
              <div className="kicker" aria-live="polite">
                Loading transactions…
              </div>
            }
          >
            <Transactions
              friend={selectedFriend}
              friendsById={friendsById}
              items={transactions}
              onRequestEdit={onRequestEdit}
              onDelete={onDeleteTransaction}
              onConfirmSettlement={onConfirmSettlement}
              onCancelSettlement={onCancelSettlement}
              onReopenSettlement={onReopenSettlement}
            />
          </Suspense>
        </>
      )}
    </section>
  );
}

export default memo(TransactionsPanel);
