import type { ReactNode } from "react";
import styles from "./AnalyticsCard.module.css";

const ACCENT_CLASS = {
  brand: styles.valueBrand,
  danger: styles.valueDanger,
  neutral: styles.valueNeutral,
} as const;

type AccentType = keyof typeof ACCENT_CLASS;

interface AnalyticsCardProps {
  title: string;
  value?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  accent?: AccentType;
  className?: string;
  children?: ReactNode;
}

export default function AnalyticsCard({
  title,
  value,
  description,
  footer,
  accent = "brand",
  className = "",
  children,
}: AnalyticsCardProps) {
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
