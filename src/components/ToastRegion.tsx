import { useEffect } from "react";
import { useToastStore } from "../state/toastStore";

const KIND_ROLE = {
  success: "status",
  info: "status",
  error: "alert",
} as const;

export default function ToastRegion() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }
    const timers = toasts.map((toast) => {
      const delay = Math.max(0, toast.dismissAt - Date.now());
      return setTimeout(() => removeToast(toast.id), delay);
    });
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, removeToast]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="toast-region"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.kind}`}
          role={KIND_ROLE[toast.kind] ?? "status"}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast__close"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
