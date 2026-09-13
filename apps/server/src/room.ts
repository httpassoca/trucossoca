import { NICKNAME_MAX, type ClientMessage, type RoomSnapshot, type ServerMessage } from '@truco/protocol';

/** A sala morre depois deste tempo sem ação de sala ou de jogo. */
export const ROOM_TTL = 10 * 60_000;
/** Quem cai tem este tempo para voltar com o mesmo token antes de sair da lista. */
export const DISCONNECT_GRACE = 20_000;
const FALLBACK_NICKNAME = 'Alguém';

export interface RoomMember {
  /** id público (vai no snapshot) */
  id: string;
  /** segredo do navegador; identifica a pessoa entre conexões */
  token: string;
  nickname: string;
  connected: boolean;
  lastActivity: number;
}

/** Timers pendentes como dado: o adaptador agenda, e devolve como entrada quando vencem. */
export type RoomTimer =
  | { kind: 'death'; at: number }
  | { kind: 'drop'; token: string; at: number };

export interface RoomState {
  code: string;
  /** `open`: recebendo gente (sem partida ainda); `dead`: encerrada */
  phase: 'open' | 'dead';
  createdAt: number;
  lastActivity: number;
  members: RoomMember[];
  /** tokens conectados que ainda não entraram com apelido */
  visitors: string[];
  nextId: number;
  timers: RoomTimer[];
}

export type RoomInput =
  | { kind: 'connect'; token: string }
  | { kind: 'disconnect'; token: string }
  | { kind: 'message'; token: string; message: ClientMessage }
  | { kind: 'timer'; timer: RoomTimer };

export interface Outgoing { to: string; message: ServerMessage }

/** O que aconteceu de notável, para o log do servidor. */
export type RoomEvent =
  | { type: 'joined'; id: string; nickname: string }
  | { type: 'renamed'; id: string; from: string; to: string }
  | { type: 'disconnected'; id: string; nickname: string }
  | { type: 'reconnected'; id: string; nickname: string }
  | { type: 'left'; id: string; nickname: string }
  | { type: 'died' };

export interface RoomOutput { state: RoomState; out: Outgoing[]; events: RoomEvent[] }

export function createRoom(code: string, now: number): RoomState {
  return { code, phase: 'open', createdAt: now, lastActivity: now, members: [], visitors: [], nextId: 1, timers: [{ kind: 'death', at: now + ROOM_TTL }] };
}

/**
 * Única porta da sala: estado atual + entrada + hora → estado novo, mensagens por destinatário e eventos.
 * Nunca mexe no estado recebido e nunca agenda nada; os timers ficam em `state.timers`.
 */
export function step(state: RoomState, input: RoomInput, now: number): RoomOutput {
  const s = structuredClone(state);
  const out: Outgoing[] = [];
  const events: RoomEvent[] = [];
  if (s.phase === 'dead') return { state: s, out, events };

  const member = (token: string) => s.members.find((m) => m.token === token);
  const broadcast = () => { for (const t of connectedTokens(s)) out.push({ to: t, message: { type: 'snapshot', snapshot: snapshotFor(s, t) } }); };
  const touch = (m?: RoomMember) => {
    s.lastActivity = now;
    if (m) m.lastActivity = now;
    s.timers = s.timers.filter((t) => t.kind !== 'death');
    s.timers.push({ kind: 'death', at: now + ROOM_TTL });
  };

  switch (input.kind) {
    case 'connect': {
      const m = member(input.token);
      if (m) {
        s.timers = s.timers.filter((t) => !(t.kind === 'drop' && t.token === m.token));
        if (!m.connected) { m.connected = true; events.push({ type: 'reconnected', id: m.id, nickname: m.nickname }); }
        broadcast();
      } else {
        if (!s.visitors.includes(input.token)) s.visitors.push(input.token);
        out.push({ to: input.token, message: { type: 'snapshot', snapshot: snapshotFor(s, input.token) } });
      }
      break;
    }
    case 'disconnect': {
      const m = member(input.token);
      if (m) {
        if (!m.connected) break;
        m.connected = false;
        s.timers.push({ kind: 'drop', token: m.token, at: now + DISCONNECT_GRACE });
        events.push({ type: 'disconnected', id: m.id, nickname: m.nickname });
        broadcast();
      } else {
        s.visitors = s.visitors.filter((t) => t !== input.token);
      }
      break;
    }
    case 'message': {
      const msg = input.message;
      const m = member(input.token);
      if (msg.type === 'ping') {
        if (m || s.visitors.includes(input.token)) out.push({ to: input.token, message: { type: 'pong' } });
        break;
      }
      if (msg.type === 'join' && !m) {
        if (!s.visitors.includes(input.token)) break;
        s.visitors = s.visitors.filter((t) => t !== input.token);
        const created: RoomMember = { id: `m${s.nextId++}`, token: input.token, nickname: uniqueNickname(s, msg.nickname), connected: true, lastActivity: now };
        s.members.push(created);
        touch(created);
        events.push({ type: 'joined', id: created.id, nickname: created.nickname });
        broadcast();
        break;
      }
      // join de quem já é membro vale como troca de apelido
      if (!m) break;
      const to = uniqueNickname(s, msg.nickname, m);
      touch(m);
      if (to !== m.nickname) {
        events.push({ type: 'renamed', id: m.id, from: m.nickname, to });
        m.nickname = to;
        broadcast();
      }
      break;
    }
    case 'timer': {
      const idx = s.timers.findIndex((t) => timerKey(t) === timerKey(input.timer));
      if (idx < 0) break; // já cancelado ou substituído
      const [t] = s.timers.splice(idx, 1);
      if (t.kind === 'death') {
        s.phase = 'dead';
        s.timers = [];
        events.push({ type: 'died' });
      } else {
        const m = member(t.token);
        if (!m || m.connected) break;
        s.members = s.members.filter((x) => x !== m);
        events.push({ type: 'left', id: m.id, nickname: m.nickname });
        broadcast();
      }
      break;
    }
  }
  return { state: s, out, events };
}

/** Quem deve receber snapshot: membros conectados e visitantes. */
export function connectedTokens(s: RoomState): string[] {
  return [...s.members.filter((m) => m.connected).map((m) => m.token), ...s.visitors];
}

/** A sala como este token a vê. Sem tokens; só ids públicos. */
export function snapshotFor(s: RoomState, token: string): RoomSnapshot {
  return {
    code: s.code,
    members: s.members.map((m) => ({ id: m.id, nickname: m.nickname, connected: m.connected })),
    you: s.members.find((m) => m.token === token)?.id ?? null,
  };
}

/** Identidade de um timer é o seu conteúdo: o adaptador usa a mesma chave para agendar e cancelar. */
export function timerKey(t: RoomTimer) { return `${t.kind}:${t.kind === 'drop' ? t.token : ''}:${t.at}`; }

/** Apara e limita o apelido; em colisão (sem diferenciar maiúsculas) acrescenta " 2", " 3"… */
function uniqueNickname(s: RoomState, raw: string, self?: RoomMember): string {
  const base = raw.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX) || FALLBACK_NICKNAME;
  const taken = new Set(s.members.filter((m) => m !== self).map((m) => m.nickname.toLocaleLowerCase()));
  if (!taken.has(base.toLocaleLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = base.slice(0, NICKNAME_MAX - suffix.length) + suffix;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
}
