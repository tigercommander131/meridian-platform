// WebSocket client with automatic reconnection (exponential backoff).
// Falls back gracefully: if the socket can't connect, it keeps retrying
// without throwing, so the rest of the app keeps working offline.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

const MAX_BACKOFF = 30_000;

export function connectRealtime({ onEvent, onState } = {}) {
  let socket = null;
  let backoff = 1000;
  let closedByUs = false;
  let reconnectTimer = null;

  function setState(state) {
    onState?.(state);
  }

  function open() {
    setState('connecting');
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      backoff = 1000; // reset backoff on a good connection
      setState('connected');
    };

    socket.onmessage = (e) => {
      try {
        onEvent?.(JSON.parse(e.data));
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      setState('disconnected');
      if (!closedByUs) scheduleReconnect();
    };

    socket.onerror = () => {
      socket?.close();
    };
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
      open();
    }, backoff);
  }

  open();

  return {
    close() {
      closedByUs = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    },
  };
}
