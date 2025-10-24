import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  createdAt: number;
  dismissAt: number;
}

const TOAST_DURATION_MS = 5000;

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "createdAt" | "dismissAt"> & Partial<Pick<Toast, "id">>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: ({ id, message, kind }) => {
    const toastId = id ?? crypto.randomUUID();
    const createdAt = Date.now();
    const dismissAt = createdAt + TOAST_DURATION_MS;
    set((state) => ({
      toasts: [
        ...state.toasts.filter((toast) => toast.id !== toastId),
        {
          id: toastId,
          message,
          kind,
          createdAt,
          dismissAt,
        },
      ],
    }));
    return toastId;
  },
  removeToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

export function useToasts() {
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);
  const clearToasts = useToastStore((state) => state.clearToasts);

  return {
    addToast,
    removeToast,
    clearToasts,
  };
}

