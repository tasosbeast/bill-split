import PropTypes from "prop-types";
import { formatEUR } from "../lib/money";
import styles from "./AnalyticsVolumeBars.module.css";

export default function AnalyticsVolumeBars({ data }) {
  if (!data || data.length === 0) {
    return <div className="kicker">No tracked volume yet.</div>;
  }

  const amounts = data.map((entry) => Math.max(0, Number(entry.amount) || 0));
  const max = Math.max(...amounts, 0);
  const total = amounts.reduce((sum, value) => sum + value, 0);

  if (max <= 0) {
    return <div className="kicker">No tracked volume yet.</div>;
  }

  return (
    <div className={styles.list}>
      {data.map((entry, index) => {
        const amount = amounts[index];
        const width = Math.max((amount / max) * 100, 6);
        const share =
          total > 0 ? Math.round((amount / total) * 100) : 0;

        return (
          <div
            key={entry.key || entry.label || `volume-${index}`}
            className={styles.item}
          >
            <div className={styles.row}>
              <span className={styles.label}>{entry.label}</span>
              <span className={styles.amount}>{formatEUR(amount)}</span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <div className={styles.fill} style={{ width: `${width}%` }} />
            </div>
            <div className={styles.meta}>{share}% of total volume</div>
          </div>
        );
      })}
    </div>
  );
}

AnalyticsVolumeBars.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string.isRequired,
      amount: PropTypes.number.isRequired,
    })
  ),
};
