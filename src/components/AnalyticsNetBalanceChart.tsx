import { formatEUR } from "../lib/money";
import styles from "./AnalyticsNetBalanceChart.module.css";

interface AnalyticsNetBalanceChartProps {
  owedToYou: number;
  youOwe: number;
}

export default function AnalyticsNetBalanceChart({
  owedToYou,
  youOwe,
}: AnalyticsNetBalanceChartProps) {
  const positive = Math.max(0, owedToYou);
  const negative = Math.max(0, youOwe);
  const total = positive + negative;

  if (total === 0) {
    return (
      <div className={styles.empty} role="presentation">
        <span className={styles.emptyLabel}>No outstanding balances.</span>
      </div>
    );
  }

  return (
    <div
      className={styles.wrapper}
      role="img"
      aria-label={`Balance composition: owed to you ${formatEUR(
        positive
      )}, you owe ${formatEUR(negative)}.`}
    >
      <div className={styles.barTrack} aria-hidden="true">
        <div className={styles.barPositive} style={{ flexGrow: positive }} />
        <div className={styles.barNegative} style={{ flexGrow: negative }} />
      </div>
      <dl className={styles.legend}>
        <div className={styles.legendItem}>
          <dt className={styles.legendLabel}>Owed to you</dt>
          <dd className={styles.legendValue}>{formatEUR(positive)}</dd>
        </div>
        <div className={styles.legendItem}>
          <dt className={styles.legendLabel}>You owe</dt>
          <dd className={styles.legendValue}>{formatEUR(negative)}</dd>
        </div>
      </dl>
    </div>
  );
}
