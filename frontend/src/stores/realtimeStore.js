import { create } from 'zustand';

const MAX_EVENTS = 20;

export const useRealtimeStore = create((set) => ({
  connection: 'connecting', // connecting | connected | disconnected
  events: [],

  setConnection: (connection) => set({ connection }),

  pushEvent: (event) =>
    set((state) => ({
      events: [{ ...event, id: `${Date.now()}-${Math.random()}` }, ...state.events].slice(0, MAX_EVENTS),
    })),
}));
