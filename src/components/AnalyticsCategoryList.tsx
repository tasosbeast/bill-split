import { formatEUR } from "../lib/money";
import styles from "./AnalyticsCategoryList.module.css";

interface CategoryItem {
  category: string;
  amount: number;
}

interface AnalyticsCategoryListProps {
  categories?: CategoryItem[];
}

export default function AnalyticsCategoryList({
  categories,
}: AnalyticsCategoryListProps) {
  if (!categories || categories.length === 0) {
    return <div className="kicker">No categorized expenses yet.</div>;
  }

  const total = categories.reduce((acc, item) => acc + item.amount, 0);
  const max = Math.max(...categories.map((item) => item.amount), 0);
  const safeMax = max > 0 ? max : 1;

  return (
    <div className={styles.list}>
      {categories.map((item) => {
        const width = Math.max((item.amount / safeMax) * 100, 4);
        const share = total > 0 ? Math.round((item.amount / total) * 100) : 0;

        return (
          <div key={item.category} className={styles.item}>
            <div className={styles.labelRow}>
              <span className={styles.category}>{item.category}</span>
              <span className={styles.amount}>{formatEUR(item.amount)}</span>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <div className={styles.barFill} style={{ width: `${width}%` }} />
            </div>
            <div className={styles.meta}>{share}% of tracked spending</div>
          </div>
        );
      })}
    </div>
  );
}
