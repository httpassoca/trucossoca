import { CLOSE_ROOM_NOT_FOUND, isScenery, parseRules, SOCKET_IDLE_TIMEOUT } from '@truco/protocol';
import type { SocketData } from './host';
import type { RoomInit, RoomPace } from './room';
import { Rooms } from './rooms';
import type { Log } from './log';
import { staticHandler } from './static';

export interface ServerOptions { port: number; distDir: string; log: Log; hostname?: string; pace?: Partial<RoomPace> }

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
/** O corpo de `POST /api/rooms` não passa disto. */
const ROOM_BODY_MAX = 4096;

/**
 * O corpo opcional de `POST /api/rooms`: `{ rules?, scenery? }`. Cada campo vale só se passar na validação do
 * protocolo; o que não passa (ou um corpo que não é JSON) é ignorado e a sala nasce com o padrão naquilo.
 */
async function readRoomInit(req: Request): Promise<RoomInit> {
  let raw: unknown;
  try {
    const text = await req.text();
    if (!text || text.length > ROOM_BODY_MAX) return {};
    raw = JSON.parse(text);
  } catch { return {}; }
  if (!raw || typeof raw !== 'object') return {};
  const body = raw as Record<string, unknown>;
  const rules = parseRules(body.rules);
  return { ...(rules ? { rules } : {}), ...(isScenery(body.scenery) ? { scenery: body.scenery } : {}) };
}

/**
 * HTTP: `/health`, `POST /api/rooms` (abre uma sala; o corpo JSON opcional traz as regras e o cenário) e o cliente
 * estático. WebSocket em `/ws?room=CODE&token=T`. Sala inexistente: o upgrade é aceito e fechado com um código que
 * o cliente sabe explicar.
 */
export function createServer(opts: ServerOptions) {
  const rooms = new Rooms(opts.log, Math.random, opts.pace);
  const serveStatic = staticHandler(opts.distDir);

  const server = Bun.serve<SocketData>({
    port: opts.port,
    hostname: opts.hostname,
    async fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === '/health') return Response.json({ ok: true, rooms: rooms.size });
      if (url.pathname === '/api/rooms') {
        if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
        return Response.json({ code: rooms.create(await readRoomInit(req)).code });
      }
      if (url.pathname === '/ws') {
        const code = (url.searchParams.get('room') ?? '').toUpperCase();
        const token = url.searchParams.get('token') ?? '';
        if (!TOKEN_RE.test(token) || !code) return new Response('room and token required', { status: 400 });
        return srv.upgrade(req, { data: { code, token } }) ? undefined : new Response('upgrade failed', { status: 400 });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('method not allowed', { status: 405 });
      return serveStatic(url.pathname);
    },
    websocket: {
      idleTimeout: SOCKET_IDLE_TIMEOUT / 1000,
      open(ws) {
        const host = rooms.get(ws.data.code);
        if (!host) { ws.close(CLOSE_ROOM_NOT_FOUND, 'sala não existe'); return; }
        host.connect(ws);
      },
      message(ws, raw) { rooms.get(ws.data.code)?.message(ws, raw); },
      close(ws) { rooms.get(ws.data.code)?.disconnect(ws); },
    },
  });

  return { server, rooms, stop: () => server.stop(true) };
}
