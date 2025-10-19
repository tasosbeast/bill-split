import PropTypes from "prop-types";
import { formatEUR } from "../lib/money";
import styles from "./AnalyticsTrendChart.module.css";

export default function AnalyticsTrendChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="kicker">No spending data yet for this timeframe.</div>;
  }

  const max = Math.max(...data.map((d) => d.amount), 0);
  const safeMax = max > 0 ? max : 1;

  return (
    <div className={styles.chart} role="list" aria-label="Monthly spending trend">
      {data.map((point) => {
        const height = Math.max((point.amount / safeMax) * 100, 6);
        return (
          <div key={point.key || point.label} className={styles.column} role="listitem">
            <div className={styles.barWrapper} aria-hidden="true">
              <div className={styles.bar} style={{ height: `${height}%` }} />
            </div>
            <div className={styles.value}>{formatEUR(point.amount)}</div>
            <div className={styles.label}>{point.label}</div>
          </div>
        );
      })}
    </div>
  );
}

AnalyticsTrendChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string.isRequired,
      amount: PropTypes.number.isRequired,
    })
  ),
};
