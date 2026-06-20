import { create } from 'zustand';

let nextId = 1;

export const useToastStore = create((set) => ({
  toasts: [],

  addToast: (message, type = 'info', ttl = 4000) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    if (ttl > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, ttl);
    }
    return id;
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Convenience helpers for non-component code.
export const toast = {
  info: (m) => useToastStore.getState().addToast(m, 'info'),
  success: (m) => useToastStore.getState().addToast(m, 'success'),
  error: (m) => useToastStore.getState().addToast(m, 'error'),
};
