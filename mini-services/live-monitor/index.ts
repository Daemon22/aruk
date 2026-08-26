// ============================================================
// Live Monitor — WebSocket mini-service (port 3003)
// ============================================================
// Broadcasts real-time API bank stats every 3 seconds.
// Uses Caddy reverse proxy: io("/?XTransformPort=3003")
// ============================================================

import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 3003;
const STATS_URL = 'http://localhost:3000/api/stats';
const ROUTING_URL = 'http://localhost:3000/api/routing?strategy=best';
const TICK_INTERVAL_MS = 3000;

// ─── HTTP + Socket.IO Server ───────────────────────────────

const httpServer = createServer();

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it for XTransformPort routing
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Stats Fetching ─────────────────────────────────────────

async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.error(`[live-monitor] Fetch failed (${url}):`, err.message);
    return null;
  }
}

// ─── Broadcast Loop ─────────────────────────────────────────

let tickCount = 0;
let broadcastTimer: ReturnType<typeof setInterval> | null = null;

async function broadcastTick() {
  tickCount++;

  // Always fetch and broadcast stats
  const stats = await fetchJSON(STATS_URL);
  if (stats) {
    io.emit('stats', stats);
  }

  // Every 10th tick, also fetch and emit routing decision
  if (tickCount % 10 === 0) {
    const routing = await fetchJSON(ROUTING_URL);
    if (routing) {
      io.emit('routing', routing);
    }
  }

  // Heartbeat every tick
  io.emit('heartbeat', {
    tick: tickCount,
    clients: io.engine.clientsCount,
    ts: new Date().toISOString(),
  });
}

// ─── Connection Handling ────────────────────────────────────

io.on('connection', async (socket) => {
  console.log(`[live-monitor] Client connected: ${socket.id} (total: ${io.engine.clientsCount})`);

  // Send current stats immediately on connect
  const stats = await fetchJSON(STATS_URL);
  if (stats) {
    socket.emit('stats', stats);
  }

  socket.on('disconnect', (reason) => {
    console.log(`[live-monitor] Client disconnected: ${socket.id} (${reason}, total: ${io.engine.clientsCount})`);
  });

  socket.on('error', (err) => {
    console.error(`[live-monitor] Socket error (${socket.id}):`, err);
  });
});

// ─── Start Server ───────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[live-monitor] WebSocket server running on port ${PORT}`);
  console.log(`[live-monitor] Broadcasting stats every ${TICK_INTERVAL_MS}ms`);

  // Start the single broadcast loop
  broadcastTimer = setInterval(broadcastTick, TICK_INTERVAL_MS);
});

// ─── Graceful Shutdown ──────────────────────────────────────

function shutdown(signal: string) {
  console.log(`[live-monitor] Received ${signal}, shutting down...`);
  if (broadcastTimer) clearInterval(broadcastTimer);
  io.close();
  httpServer.close(() => {
    console.log('[live-monitor] Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));