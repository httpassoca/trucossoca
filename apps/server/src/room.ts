import { DEFAULT_TEAM_NAMES, NICKNAME_MAX, TEAM_NAME_MAX, type ClientMessage, type RoomSnapshot, type ServerMessage } from '@truco/protocol';
import { createGame, defaultRules, startHand, takeEvents, teamOf, viewFor, type GameEvent, type GameState, type Perspective, type Rng, type Rules, type Seat, type Team } from '@truco/rules';

/** A sala morre depois deste tempo sem ação de sala ou de jogo. */
export const ROOM_TTL = 10 * 60_000;
/** Quem cai tem este tempo para voltar com o mesmo token antes de sair da lista. */
export const DISCONNECT_GRACE = 20_000;
const FALLBACK_NICKNAME = 'Alguém';
/** Apelidos dos bots, na ordem; pula os que já estão na sala. */
const BOT_NAMES = ['Tião', 'Nena', 'Bastião', 'Cida', 'Dito', 'Zefa'];
/** Cadeiras de cada dupla, na ordem em que são ocupadas. */
const TEAM_SEATS: Record<Team, Seat[]> = { 0: [0, 2], 1: [1, 3] };

export interface RoomMember {
  /** id público (vai no snapshot) */
  id: string;
  /** segredo do navegador; identifica a pessoa entre conexões. Bots não têm. */
  token: string | null;
  nickname: string;
  connected: boolean;
  lastActivity: number;
  /** cadeira ocupada; null = fantasma */
  seat: Seat | null;
  bot: boolean;
}

/** Timers pendentes como dado: o adaptador agenda, e devolve como entrada quando vencem. */
export type RoomTimer =
  | { kind: 'death'; at: number }
  | { kind: 'drop'; token: string; at: number };

export interface RoomState {
  code: string;
  /** `lobby`: escolhendo duplas; `playing`: partida em curso; `dead`: encerrada */
  phase: 'lobby' | 'playing' | 'dead';
  createdAt: number;
  lastActivity: number;
  members: RoomMember[];
  /** tokens conectados que ainda não entraram com apelido */
  visitors: string[];
  nextId: number;
  timers: RoomTimer[];
  teams: [string, string];
  /** regras da próxima partida; durante a partida, as em vigor estão em `game.rules` */
  rules: Rules;
  ghostsSeeCards: boolean;
  /** a partida inteira, com todas as cartas; só sai daqui filtrada por `snapshotFor` */
  game: GameState | null;
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
  | { type: 'seated'; id: string; nickname: string; seat: Seat }
  | { type: 'unseated'; id: string; nickname: string }
  | { type: 'started'; humans: number; bots: number }
  | { type: 'died' };

export interface RoomOutput { state: RoomState; out: Outgoing[]; events: RoomEvent[] }

export function createRoom(code: string, now: number): RoomState {
  return {
    code, phase: 'lobby', createdAt: now, lastActivity: now, members: [], visitors: [], nextId: 1,
    timers: [{ kind: 'death', at: now + ROOM_TTL }],
    teams: [...DEFAULT_TEAM_NAMES], rules: copyRules(defaultRules), ghostsSeeCards: true, game: null,
  };
}

/**
 * Única porta da sala: estado atual + entrada + hora → estado novo, mensagens por destinatário e eventos.
 * Nunca mexe no estado recebido e nunca agenda nada; os timers ficam em `state.timers`.
 * `rng` embaralha as cartas quando a partida começa (injetável nos testes).
 */
export function step(state: RoomState, input: RoomInput, now: number, rng: Rng = Math.random): RoomOutput {
  const s = structuredClone(state);
  const out: Outgoing[] = [];
  const events: RoomEvent[] = [];
  if (s.phase === 'dead') return { state: s, out, events };

  const member = (token: string) => s.members.find((m) => m.token === token);
  /** todo mundo recebe a sala inteira; os eventos da mesa (se houver) vão antes do snapshot que os causou */
  const broadcast = (gameEvents: GameEvent[] = []) => {
    for (const t of connectedTokens(s)) {
      if (gameEvents.length) out.push({ to: t, message: { type: 'events', events: gameEvents } });
      out.push({ to: t, message: { type: 'snapshot', snapshot: snapshotFor(s, t) } });
    }
  };
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
        s.timers.push({ kind: 'drop', token: m.token!, at: now + DISCONNECT_GRACE });
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
        const created: RoomMember = { id: `m${s.nextId++}`, token: input.token, nickname: uniqueNickname(s, msg.nickname), connected: true, lastActivity: now, seat: null, bot: false };
        s.members.push(created);
        touch(created);
        events.push({ type: 'joined', id: created.id, nickname: created.nickname });
        broadcast();
        break;
      }
      if (!m) break;
      if (msg.type === 'join' || msg.type === 'nickname') {
        // join de quem já é membro vale como troca de apelido
        const to = uniqueNickname(s, msg.nickname, m);
        touch(m);
        if (to !== m.nickname) {
          events.push({ type: 'renamed', id: m.id, from: m.nickname, to });
          m.nickname = to;
          broadcast();
        }
        break;
      }
      if (msg.type === 'ghostsSeeCards') {
        // vale também durante a partida: é sobre quem assiste, não sobre quem joga
        touch(m);
        if (s.ghostsSeeCards !== msg.on) { s.ghostsSeeCards = msg.on; broadcast(); }
        break;
      }
      // daqui para baixo, só no lobby: duplas, nomes e regras ficam trancados durante a partida
      if (s.phase !== 'lobby') break;
      if (msg.type === 'takeSeat') {
        if (m.seat !== null && teamOf(m.seat) === msg.team) break;
        const free = TEAM_SEATS[msg.team].find((seat) => !s.members.some((o) => o.seat === seat));
        if (free === undefined) break;
        m.seat = free;
        touch(m);
        events.push({ type: 'seated', id: m.id, nickname: m.nickname, seat: free });
        broadcast();
      } else if (msg.type === 'leaveSeat') {
        if (m.seat === null) break;
        m.seat = null;
        touch(m);
        events.push({ type: 'unseated', id: m.id, nickname: m.nickname });
        broadcast();
      } else if (msg.type === 'renameTeam') {
        touch(m);
        const name = msg.name.replace(/\s+/g, ' ').trim().slice(0, TEAM_NAME_MAX) || DEFAULT_TEAM_NAMES[msg.team];
        if (s.teams[msg.team] !== name) { s.teams[msg.team] = name; broadcast(); }
      } else if (msg.type === 'rules') {
        touch(m);
        s.rules = copyRules(msg.rules);
        broadcast();
      } else if (msg.type === 'start') {
        if (m.seat === null || !canStart(s)) break;
        fillWithBots(s, now);
        s.game = createGame(s.rules);
        startHand(s.game, rng);
        s.phase = 'playing';
        touch(m);
        events.push({ type: 'started', humans: s.members.filter((o) => o.seat !== null && !o.bot).length, bots: s.members.filter((o) => o.bot).length });
        broadcast(takeEvents(s.game));
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

/** Pelo menos uma pessoa sentada, no máximo duas por dupla e uma por cadeira. */
function canStart(s: RoomState): boolean {
  const seated = s.members.filter((m) => m.seat !== null && !m.bot);
  if (seated.length === 0) return false;
  for (const team of [0, 1] as Team[]) if (seated.filter((m) => teamOf(m.seat!) === team).length > 2) return false;
  return new Set(seated.map((m) => m.seat)).size === seated.length;
}

/** Cada cadeira vazia ganha um bot com o próximo apelido livre da lista. */
function fillWithBots(s: RoomState, now: number) {
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    if (s.members.some((m) => m.seat === seat)) continue;
    const taken = new Set(s.members.map((m) => m.nickname.toLocaleLowerCase()));
    const nickname = BOT_NAMES.find((n) => !taken.has(n.toLocaleLowerCase())) ?? uniqueNickname(s, BOT_NAMES[0]);
    s.members.push({ id: `m${s.nextId++}`, token: null, nickname, connected: true, lastActivity: now, seat, bot: true });
  }
}

/** Quem deve receber snapshot: membros conectados e visitantes. */
export function connectedTokens(s: RoomState): string[] {
  return [...s.members.filter((m) => m.connected && m.token !== null).map((m) => m.token!), ...s.visitors];
}

/**
 * A sala como este token a vê. Sem tokens; só ids públicos. Quem está sentado vê só as próprias cartas
 * (e as do parceiro na decisão da mão de dez); fantasma vê tudo ou nada conforme o toggle; visitante
 * (ainda sem apelido) não vê carta nenhuma.
 */
export function snapshotFor(s: RoomState, token: string): RoomSnapshot {
  const me = s.members.find((m) => m.token === token);
  const from: Perspective = me ? (me.seat ?? (s.ghostsSeeCards ? 'all' : 'none')) : 'none';
  return {
    code: s.code,
    phase: s.phase === 'playing' ? 'playing' : 'lobby',
    members: s.members.map((m) => ({ id: m.id, nickname: m.nickname, connected: m.connected, seat: m.seat, bot: m.bot })),
    you: me?.id ?? null,
    teams: [...s.teams],
    rules: copyRules(s.game ? s.game.rules : s.rules),
    ghostsSeeCards: s.ghostsSeeCards,
    game: s.game ? viewFor(s.game, from) : null,
  };
}

/** Regras são dado plano com uma lista dentro: copiar é não compartilhar a escada com ninguém. */
const copyRules = (r: Rules): Rules => ({ ...r, ladder: [...r.ladder] });

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
