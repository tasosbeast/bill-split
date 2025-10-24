import { useCallback, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, children, onClose }) {
  const backdropRef = useRef(null);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);
  const titleId = useMemo(() => `modal-title-${Math.random().toString(36).slice(2)}`, []);

  const focusFirstInput = useCallback(() => {
    const firstField = firstFieldRef.current;
    if (firstField && typeof firstField.focus === "function") {
      firstField.focus();
      return true;
    }
    const dialog = dialogRef.current;
    if (!dialog) return false;
    const focusables = dialog.querySelectorAll(FOCUSABLE_SELECTORS);
    if (focusables.length > 0) {
      (focusables[0] instanceof HTMLElement ? focusables[0] : dialog).focus();
      return true;
    }
    dialog.focus();
    return true;
  }, []);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      (document.activeElement instanceof HTMLElement && document.activeElement) || null;
    const focusTimer = window.setTimeout(() => {
      focusFirstInput();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      const lastFocused = previouslyFocusedElementRef.current;
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    };
  }, [focusFirstInput]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
        (element) => element instanceof HTMLElement && !element.hasAttribute("disabled")
      );
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropMouseDown = useCallback(
    (event) => {
      if (event.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  const handleBackdropKeyDown = useCallback(
    (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        focusFirstInput();
      }
    },
    [focusFirstInput]
  );

  const renderChildren = useMemo(() => {
    return typeof children === "function"
      ? children({ firstFieldRef })
      : children;
  }, [children]);

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      data-backdrop
      onMouseDown={handleBackdropMouseDown}
      onKeyDown={handleBackdropKeyDown}
    >
      <div
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <span aria-hidden="true">{"\u2715"}</span>
          </button>
        </header>
        {renderChildren}
      </div>
    </div>
  );
}

Modal.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  onClose: PropTypes.func.isRequired,
};
