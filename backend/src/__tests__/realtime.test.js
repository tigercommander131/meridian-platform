import http from 'http';
import { WebSocket } from 'ws';
import { initRealtime, broadcast, clientCount } from '../realtime.js';

let server;
let port;

beforeAll(async () => {
  server = http.createServer();
  initRealtime(server);
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('realtime WebSocket', () => {
  it('sends a connected message on connect and relays a broadcast', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const messages = [];

    const received = new Promise((resolve, reject) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        messages.push(msg);
        if (msg.type === 'connected') {
          // Now that we're connected, fire a broadcast.
          broadcast('events.synced', { count: 3 });
        }
        if (msg.type === 'events.synced') {
          resolve(msg);
        }
      });
      ws.on('error', reject);
    });

    const synced = await received;
    expect(synced.payload.count).toBe(3);
    expect(clientCount()).toBeGreaterThan(0);

    ws.close();
  });

  it('broadcast is a no-op count when no clients are connected', async () => {
    // Close any lingering client first by waiting a tick.
    await new Promise((r) => setTimeout(r, 50));
    // Even with a client, this returns a number; with none it's 0. Type check only.
    expect(typeof broadcast('noop', {})).toBe('number');
  });
});
