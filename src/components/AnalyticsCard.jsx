import PropTypes from "prop-types";
import styles from "./AnalyticsCard.module.css";

const ACCENT_CLASS = {
  brand: styles.valueBrand,
  danger: styles.valueDanger,
  neutral: styles.valueNeutral,
};

export default function AnalyticsCard({
  title,
  value,
  description,
  footer,
  accent = "brand",
  className = "",
  children,
}) {
  const accentClass = ACCENT_CLASS[accent] || styles.valueNeutral;

  return (
    <section className={`${styles.card} ${className}`.trim()}>
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          {description ? (
            <p className={styles.description}>{description}</p>
          ) : null}
        </div>
        {value !== undefined ? (
          <div className={`${styles.value} ${accentClass}`}>{value}</div>
        ) : null}
      </header>

      {children ? <div className={styles.body}>{children}</div> : null}

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  );
}

AnalyticsCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.node,
  description: PropTypes.node,
  footer: PropTypes.node,
  accent: PropTypes.oneOf(["brand", "danger", "neutral"]),
  className: PropTypes.string,
  children: PropTypes.node,
};
