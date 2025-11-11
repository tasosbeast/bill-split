import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  title: string;
  children:
    | ReactNode
    | ((props: {
        firstFieldRef: RefObject<HTMLInputElement | null>;
      }) => ReactNode);
  onClose: () => void;
}

export default function Modal({ title, children, onClose }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleId = useMemo(
    () => `modal-title-${Math.random().toString(36).slice(2)}`,
    []
  );

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
      const firstFocusable = focusables[0];
      if (firstFocusable instanceof HTMLElement) {
        firstFocusable.focus();
      } else {
        dialog.focus();
      }
      return true;
    }
    dialog.focus();
    return true;
  }, []);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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
    (event: KeyboardEvent<HTMLDivElement>) => {
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
      const focusables = Array.from(
        dialog.querySelectorAll(FOCUSABLE_SELECTORS)
      ).filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && !element.hasAttribute("disabled")
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
    const handler = (event: globalThis.KeyboardEvent) => {
      handleKeyDown(event as unknown as KeyboardEvent<HTMLDivElement>);
    };
    dialog.addEventListener("keydown", handler);
    return () => dialog.removeEventListener("keydown", handler);
  }, [handleKeyDown]);

  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  const handleBackdropKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
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
        onMouseDown={(event: MouseEvent<HTMLDivElement>) =>
          event.stopPropagation()
        }
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
