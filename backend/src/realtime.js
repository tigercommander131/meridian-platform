import { WebSocketServer } from 'ws';

// Live updates over WebSocket. Kept separate from app.js/server.js so
// controllers can import broadcast() without creating an import cycle.

let wss = null;
const clients = new Set();

export function initRealtime(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });

  console.log('🔌 WebSocket server ready on /ws');
  return wss;
}

/** Send an event to every connected client. No-op if realtime isn't running. */
export function broadcast(type, payload = {}) {
  if (!wss) return 0;
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  let sent = 0;
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
      sent++;
    }
  }
  return sent;
}

export function clientCount() {
  return clients.size;
}
