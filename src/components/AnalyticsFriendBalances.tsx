import { formatEUR } from "../lib/money";
import styles from "./AnalyticsFriendBalances.module.css";

interface FriendBalanceEntry {
  friendId: string;
  name: string;
  balance: number;
}

interface AnalyticsFriendBalancesProps {
  entries?: FriendBalanceEntry[];
}

export default function AnalyticsFriendBalances({
  entries,
}: AnalyticsFriendBalancesProps) {
  if (!entries || entries.length === 0) {
    return <div className="kicker">No balances tracked for friends yet.</div>;
  }

  const maxAmount = Math.max(
    ...entries.map((entry) => Math.abs(entry.balance)),
    0
  );
  const safeMax = maxAmount > 0 ? maxAmount : 1;

  return (
    <div className={styles.list}>
      {entries.map((entry) => {
        const isPositive = entry.balance > 0;
        const amount = formatEUR(Math.abs(entry.balance));
        const width = Math.max((Math.abs(entry.balance) / safeMax) * 100, 6);

        return (
          <div key={entry.friendId} className={styles.item}>
            <div className={styles.labelRow}>
              <span className={styles.name}>{entry.name}</span>
              <span
                className={`${styles.amount} ${
                  isPositive ? styles.amountPositive : styles.amountNegative
                }`}
              >
                {isPositive ? "+" : "-"}
                {amount}
              </span>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <div
                className={`${styles.barFill} ${
                  isPositive ? styles.barPositive : styles.barNegative
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
            <div className={styles.meta}>
              {isPositive
                ? `${entry.name} owes you`
                : `You owe ${entry.name}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
