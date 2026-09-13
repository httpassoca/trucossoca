import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { CLOSE_REPLACED, CLOSE_ROOM_NOT_FOUND, type RoomSnapshot, type ServerMessage } from '@truco/protocol';
import { teamOf, type Seat } from '@truco/rules';
import { createServer } from '../src/server';
import { silentLog } from '../src/log';

/** Servidor de verdade numa porta livre; o adaptador de socket é coberto aqui só no que o deploy e o cliente dependem. */
let app: ReturnType<typeof createServer>;
let base: string;
const wsUrl = (room: string, token: string) => `${base.replace('http', 'ws')}/ws?room=${room}&token=${token}`;

beforeAll(() => {
  app = createServer({ port: 0, distDir: '/nonexistent', log: silentLog, pace: { botDelay: 1, handPause: 1 } });
  base = `http://localhost:${app.server.port}`;
});
afterAll(() => app.stop());

function nextMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((res) => ws.addEventListener('message', (e) => res(JSON.parse(String(e.data))), { once: true }));
}
function closed(ws: WebSocket): Promise<CloseEvent> {
  return new Promise((res) => ws.addEventListener('close', (e) => res(e as CloseEvent), { once: true }));
}

describe('servidor', () => {
  test('/health responde', async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, rooms: 0 });
  });

  test('sem cliente buildado, a raiz explica em vez de quebrar', async () => {
    const r = await fetch(`${base}/`);
    expect(r.status).toBe(503);
  });

  test('POST /api/rooms abre uma sala com código curto', async () => {
    const r = await fetch(`${base}/api/rooms`, { method: 'POST' });
    const { code } = (await r.json()) as { code: string };
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(app.rooms.get(code)).toBeDefined();
  });

  test('sala desconhecida fecha o socket com o código que o cliente entende', async () => {
    const ws = new WebSocket(wsUrl('ZZZZ', 'token-desconhecido-1'));
    const e = await closed(ws);
    expect(e.code).toBe(CLOSE_ROOM_NOT_FOUND);
  });

  test('duas conexões na mesma sala veem os apelidos uma da outra', async () => {
    const { code } = (await (await fetch(`${base}/api/rooms`, { method: 'POST' })).json()) as { code: string };
    const a = new WebSocket(wsUrl(code, 'token-aaaaaaaa'));
    const first = await nextMessage(a);
    expect(first).toMatchObject({ type: 'snapshot', snapshot: { code, phase: 'lobby', members: [], you: null, game: null } });

    a.send(JSON.stringify({ type: 'join', nickname: 'Zé' }));
    const joined = await nextMessage(a);
    expect(joined.type).toBe('snapshot');

    const b = new WebSocket(wsUrl(code, 'token-bbbbbbbb'));
    await nextMessage(b);
    const seenByA = nextMessage(a);
    b.send(JSON.stringify({ type: 'join', nickname: 'Zé' }));
    const snapA = (await seenByA) as { snapshot: RoomSnapshot };
    expect(snapA.snapshot.members.map((m) => m.nickname)).toEqual(['Zé', 'Zé 2']);
    a.close(); b.close();
  });

  test('um socket novo com o mesmo token assume o lugar do velho e recebe o snapshot na hora', async () => {
    const { code } = (await (await fetch(`${base}/api/rooms`, { method: 'POST' })).json()) as { code: string };
    const a1 = new WebSocket(wsUrl(code, 'token-cccccccc'));
    await nextMessage(a1);
    a1.send(JSON.stringify({ type: 'join', nickname: 'Zé' }));
    await nextMessage(a1);

    const a2 = new WebSocket(wsUrl(code, 'token-cccccccc'));
    const [gone, snap] = await Promise.all([closed(a1), nextMessage(a2)]);
    expect(gone.code).toBe(CLOSE_REPLACED);
    expect(snap).toMatchObject({ type: 'snapshot', snapshot: { members: [{ nickname: 'Zé', connected: true }] } });
    expect((snap as { snapshot: RoomSnapshot }).snapshot.you).toBe('m1');
    expect(app.rooms.get(code)!.connections).toBe(1);
    a2.close();
  });

  test('duas abas sentam, uma começa, e cada uma recebe a mesa só com as próprias cartas', async () => {
    const { code } = (await (await fetch(`${base}/api/rooms`, { method: 'POST' })).json()) as { code: string };
    const a = new WebSocket(wsUrl(code, 'token-dddddddd'));
    const b = new WebSocket(wsUrl(code, 'token-eeeeeeee'));
    await Promise.all([nextMessage(a), nextMessage(b)]);
    // cada ação na sala manda um snapshot novo para as duas abas
    const say = async (ws: WebSocket, msg: object) => { const p = Promise.all([nextMessage(a), nextMessage(b)]); ws.send(JSON.stringify(msg)); return p; };
    await say(a, { type: 'join', nickname: 'Zé' });
    await say(b, { type: 'join', nickname: 'Dita' });
    await say(a, { type: 'takeSeat', team: 0 });
    await say(b, { type: 'takeSeat', team: 1 });

    const eventsA = nextMessage(a), eventsB = nextMessage(b);
    a.send(JSON.stringify({ type: 'start' }));
    expect((await eventsA).type).toBe('events');
    expect((await eventsB).type).toBe('events');
    const [snapA, snapB] = (await Promise.all([nextMessage(a), nextMessage(b)])) as { snapshot: RoomSnapshot }[];
    expect(snapA.snapshot.phase).toBe('playing');
    expect(snapA.snapshot.members.map((m) => [m.nickname, m.seat, m.bot])).toEqual([['Zé', 0, false], ['Dita', 1, false], ['Tião', 2, true], ['Nena', 3, true]]);
    const handA = snapA.snapshot.game!.hand!, handB = snapB.snapshot.game!.hand!;
    expect(handA.cards[0].every((c) => c !== null)).toBe(true);
    expect(handA.cards[1]).toEqual([null, null, null]);
    expect(handB.cards[1].every((c) => c !== null)).toBe(true);
    expect(handB.cards[0]).toEqual([null, null, null]);
    expect(handA.stock).toBe(28);
    a.close(); b.close();
  });

  test('duas abas e dois bots jogam uma partida inteira pelo socket e a revanche devolve a sala ao lobby', async () => {
    const { code } = (await (await fetch(`${base}/api/rooms`, { method: 'POST' })).json()) as { code: string };
    const a = new WebSocket(wsUrl(code, 'token-ffffffff'));
    const b = new WebSocket(wsUrl(code, 'token-gggggggg'));
    await Promise.all([nextMessage(a), nextMessage(b)]);
    // cada aba joga pelo que o snapshot mostra: primeira carta, aceita truco, joga a mão de dez
    const play = (ws: WebSocket, seat: Seat) => ws.addEventListener('message', (e) => {
      const m = JSON.parse(String(e.data)) as ServerMessage; if (m.type !== 'snapshot') return;
      const g = m.snapshot.game, h = g?.hand; if (!g || !h || g.over || h.phase === 'over') return;
      const send = (msg: object) => ws.send(JSON.stringify(msg));
      if (h.phase === 'dezDecision') { if (h.decider === teamOf(seat)) send({ type: 'decideDez', action: 'play' }); }
      else if (h.phase === 'respond') { if (teamOf(h.pending!.by) !== teamOf(seat)) send({ type: 'respond', action: 'accept' }); }
      else if (h.turn === seat) send({ type: 'play', id: h.cards[seat][0], covered: false });
    });
    const over = (ws: WebSocket) => new Promise<RoomSnapshot>((res) => ws.addEventListener('message', (e) => {
      const m = JSON.parse(String(e.data)) as ServerMessage;
      if (m.type === 'snapshot' && m.snapshot.game?.over) res(m.snapshot);
    }));
    const errors: ServerMessage[] = [];
    for (const ws of [a, b]) ws.addEventListener('message', (e) => { const m = JSON.parse(String(e.data)) as ServerMessage; if (m.type === 'error') errors.push(m); });
    play(a, 0); play(b, 1);
    const finished = Promise.all([over(a), over(b)]);
    const say = async (ws: WebSocket, msg: object) => { const p = Promise.all([nextMessage(a), nextMessage(b)]); ws.send(JSON.stringify(msg)); return p; };
    await say(a, { type: 'join', nickname: 'Zé' });
    await say(b, { type: 'join', nickname: 'Dita' });
    await say(a, { type: 'takeSeat', team: 0 });
    await say(b, { type: 'takeSeat', team: 1 });
    a.send(JSON.stringify({ type: 'start' }));
    const [endA, endB] = await finished;
    expect(endA.game!.scores).toEqual(endB.game!.scores);
    expect(endA.game!.scores[endA.game!.winner!]).toBeGreaterThanOrEqual(12);
    expect(errors).toEqual([]);

    const lobby = nextMessage(b);
    a.send(JSON.stringify({ type: 'rematch' }));
    const snap = (await lobby) as { snapshot: RoomSnapshot };
    expect(snap.snapshot.phase).toBe('lobby');
    expect(snap.snapshot.members.map((m) => [m.nickname, m.seat, m.bot])).toEqual([['Zé', 0, false], ['Dita', 1, false]]);
    a.close(); b.close();
  });
});
