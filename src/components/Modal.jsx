import { useEffect, useRef } from "react";
import PropTypes from "prop-types";

export default function Modal({ title, children, onClose }) {
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus first field when open
  useEffect(() => {
    const t = setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Basic focus trap (cheap and cheerful)
  useEffect(() => {
    const container = dialogRef.current;
    if (!container) return;

    const selectors =
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(container.querySelectorAll(selectors)).filter(
        (el) => !el.hasAttribute("disabled")
      );

    function handleTab(e) {
      if (e.key !== "Tab") return;
      const focusables = getFocusable();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", handleTab);
    return () => container.removeEventListener("keydown", handleTab);
  }, []);

  function backdropClick(e) {
    if (e.target.dataset.backdrop) onClose();
  }

  return (
    <div
      className="modal-backdrop"
      data-backdrop
      onMouseDown={backdropClick}
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div
        className="modal"
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <h3>{title}</h3>
          <button className="close" onClick={onClose} aria-label="Close modal">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        {/* Pass a ref handle so child can auto-focus first field */}
        {typeof children === "function"
          ? children({ firstFieldRef })
          : children}
      </div>
    </div>
  );
}

Modal.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  onClose: PropTypes.func.isRequired,
};
