import { DEAL_MS, DEFAULT_SCENERY, DEFAULT_TEAM_NAMES, IDLE_HANDOFF, NICKNAME_MAX, TEAM_NAME_MAX, type ActionError, type ClientMessage, type RoomSnapshot, type SceneryId, type ServerMessage } from '@truco/protocol';
import {
  chooseBotDez, chooseBotPlay, chooseBotResponse, createGame, decideDez, defaultRules, eventsFor, handUntouched, playCard, raise, respond, responderSeat,
  startHand, takeEvents, teamOf, thinkTime, viewFor, type CardId, type GameEvent, type GameState, type Perspective, type Rng, type Rules, type Seat, type Team,
} from '@truco/rules';

/** A sala morre depois deste tempo sem ação de sala ou de jogo. */
export const ROOM_TTL = 10 * 60_000;
/** Quem cai tem este tempo para voltar com o mesmo token: no lobby, antes de sair da lista; na partida, antes de um bot jogar pela cadeira. */
export const DISCONNECT_GRACE = 20_000;
/**
 * Ritmo da mesa: `handPause` é a pausa entre o fim de uma mão e a seguinte, ms; `think` multiplica o que um bot
 * "pensa" (`thinkTime`, sorteado do rng: 1 em produção, os testes apressam); `deal` é quanto a primeira ação de
 * um bot em cada mão espera pela coreografia de dar as cartas (`DEAL_MS` em produção).
 */
export interface RoomPace { handPause: number; think: number; deal: number }
export const DEFAULT_PACE: RoomPace = { handPause: 2200, think: 1, deal: DEAL_MS };
/** O que uma sala nasce com, além dos padrões: as regras e o cenário pedidos ao abrir (`POST /api/rooms`). */
export interface RoomInit { rules?: Rules; scenery?: SceneryId }
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
  /** pessoa sentada por quem um bot joga agora: caiu por mais de `DISCONNECT_GRACE`, ou ficou parada e alguém passou a cadeira */
  botControlled: boolean;
}

/** Timers pendentes como dado: o adaptador agenda, e devolve como entrada quando vencem. */
export type RoomTimer =
  | { kind: 'death'; at: number }
  | { kind: 'drop'; token: string; at: number }
  /** a vez é de um bot: ele joga quando vencer (se a situação ainda for a mesma) */
  | { kind: 'bot'; seat: Seat; at: number }
  /** a mão acabou e a partida não: a seguinte começa quando vencer */
  | { kind: 'nextHand'; at: number };

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
  /** o cenário da sala; troca só no lobby */
  scenery: SceneryId;
  pace: RoomPace;
  /** a partida inteira, com todas as cartas; só sai daqui filtrada por `snapshotFor` */
  game: GameState | null;
}

export type RoomInput =
  | { kind: 'connect'; token: string }
  /** `since`: quando a pessoa deu o último sinal de vida, se a queda só foi notada pelo silêncio; a tolerância conta dali */
  | { kind: 'disconnect'; token: string; since?: number }
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
  | { type: 'gameOver'; winner: Team; scores: string }
  | { type: 'rematch'; id: string; nickname: string }
  /** um bot passou a jogar pela cadeira desta pessoa: ela caiu, ou ficou parada e `by` passou a cadeira */
  | { type: 'botTakeover'; id: string; nickname: string; seat: Seat; cause: 'dropped' | 'idle'; by?: string }
  /** a pessoa voltou (ou agiu) e a cadeira é dela de novo */
  | { type: 'reclaimed'; id: string; nickname: string; seat: Seat }
  | { type: 'died' };

export interface RoomOutput { state: RoomState; out: Outgoing[]; events: RoomEvent[] }

/**
 * O que `step` sorteia: `rng` embaralha, sorteia o carteador da primeira mão, semeia onde as cartas caem, decide os
 * bots e quanto pensam; `deck` fixa o baralho de uma mão e `dealer` o carteador da primeira mão de cada partida (testes).
 */
export interface StepOptions { rng?: Rng; deck?: (handNo: number) => CardId[] | undefined; dealer?: Seat }

/** `pace` completa os padrões (os testes só apressam o que precisam); `init` são as regras e o cenário pedidos ao abrir. */
export function createRoom(code: string, now: number, pace: Partial<RoomPace> = {}, init: RoomInit = {}): RoomState {
  return {
    code, phase: 'lobby', createdAt: now, lastActivity: now, members: [], visitors: [], nextId: 1,
    timers: [{ kind: 'death', at: now + ROOM_TTL }],
    teams: [...DEFAULT_TEAM_NAMES], rules: copyRules(init.rules ?? defaultRules), ghostsSeeCards: true, scenery: init.scenery ?? DEFAULT_SCENERY,
    pace: { ...DEFAULT_PACE, ...pace }, game: null,
  };
}

const GAME_ACTIONS = new Set<ClientMessage['type']>(['play', 'raise', 'respond', 'decideDez', 'rematch', 'handToBot']);

/**
 * Única porta da sala: estado atual + entrada + hora → estado novo, mensagens por destinatário e eventos.
 * Nunca mexe no estado recebido e nunca agenda nada; os timers ficam em `state.timers`.
 */
export function step(state: RoomState, input: RoomInput, now: number, opts: StepOptions = {}): RoomOutput {
  const rng = opts.rng ?? Math.random;
  const s = structuredClone(state);
  const out: Outgoing[] = [];
  const events: RoomEvent[] = [];
  if (s.phase === 'dead') return { state: s, out, events };

  const member = (token: string) => s.members.find((m) => m.token === token);
  /** todo mundo recebe a sala inteira; os eventos da mesa (se houver) vão antes do snapshot que os causou, cada um como o destinatário pode vê-los */
  const broadcast = (gameEvents: GameEvent[] = []) => {
    for (const t of connectedTokens(s)) {
      if (gameEvents.length) out.push({ to: t, message: { type: 'events', events: eventsFor(gameEvents, perspectiveOf(s, t)) } });
      out.push({ to: t, message: { type: 'snapshot', snapshot: snapshotFor(s, t, now) } });
    }
  };
  /** um bot passa a jogar pela cadeira de `m`; a mesa pode ter de agir já */
  const takeover = (m: RoomMember, cause: 'dropped' | 'idle', by?: string) => {
    m.botControlled = true;
    events.push({ type: 'botTakeover', id: m.id, nickname: m.nickname, seat: m.seat!, cause, ...(by === undefined ? {} : { by }) });
    scheduleGame(s, now, rng);
  };
  /** a cadeira volta a ser de `m`: o bot para (o timer dele cai) e o relógio de parada recomeça */
  const reclaim = (m: RoomMember) => {
    m.botControlled = false;
    m.lastActivity = now;
    events.push({ type: 'reclaimed', id: m.id, nickname: m.nickname, seat: m.seat! });
    scheduleGame(s, now, rng);
  };
  /** depois de qualquer mexida na partida: drena os eventos, avisa todo mundo e pede o próximo timer da mesa */
  const afterAction = () => {
    const g = s.game!;
    const gameEvents = takeEvents(g);
    if (gameEvents.some((e) => e.type === 'gameOver')) events.push({ type: 'gameOver', winner: g.winner!, scores: `${g.scores[0]}x${g.scores[1]}` });
    scheduleGame(s, now, rng);
    broadcast(gameEvents);
  };
  /** a mão seguinte; na primeira de cada partida, o carteador fixado pelos testes, se houver */
  const newHand = () => {
    const g = s.game!;
    startHand(g, rng, { deck: opts.deck?.(g.handNo + 1), ...(g.handNo === 0 && opts.dealer !== undefined ? { dealer: opts.dealer } : {}) });
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
        if (m.botControlled) reclaim(m);
        broadcast();
      } else {
        if (!s.visitors.includes(input.token)) s.visitors.push(input.token);
        out.push({ to: input.token, message: { type: 'snapshot', snapshot: snapshotFor(s, input.token, now) } });
      }
      break;
    }
    case 'disconnect': {
      const m = member(input.token);
      if (m) {
        if (!m.connected) break;
        m.connected = false;
        s.timers.push({ kind: 'drop', token: m.token!, at: Math.max(now, (input.since ?? now) + DISCONNECT_GRACE) });
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
      if (msg.type === 'presence') break; // passa por fora da sala: o host repassa aos outros, e não é atividade
      if (msg.type === 'join' && !m) {
        if (!s.visitors.includes(input.token)) break;
        s.visitors = s.visitors.filter((t) => t !== input.token);
        const created: RoomMember = { id: `m${s.nextId++}`, token: input.token, nickname: uniqueNickname(s, msg.nickname), connected: true, lastActivity: now, seat: null, bot: false, botControlled: false };
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
      if (msg.type === 'takeBotSeat') {
        // fantasma senta no lugar de um bot de verdade, só na pausa entre mãos; a cadeira de uma pessoa ausente continua dela
        const refuse = (reason: ActionError) => out.push({ to: input.token, message: { type: 'error', action: msg.type, reason } });
        if (s.phase !== 'playing' || !s.game) { refuse('notPlaying'); break; }
        const bot = s.members.find((o) => o.seat === msg.seat && o.bot);
        if (m.seat !== null || !bot || s.game.over) { refuse('illegal'); break; }
        if (s.game.hand?.phase !== 'over') { refuse('midHand'); break; }
        s.members = s.members.filter((o) => o !== bot);
        m.seat = msg.seat;
        touch(m);
        events.push({ type: 'seated', id: m.id, nickname: m.nickname, seat: msg.seat });
        broadcast();
        break;
      }
      if (GAME_ACTIONS.has(msg.type)) {
        // jogadas: só de quem senta, só durante a partida, e só o que o motor aceita; recusa vai só a quem errou
        const refuse = (reason: ActionError) => out.push({ to: input.token, message: { type: 'error', action: msg.type, reason } });
        if (s.phase !== 'playing' || !s.game) { refuse('notPlaying'); break; }
        if (m.seat === null) { refuse('notSeated'); break; }
        // quem tinha um bot jogando por si e age, retoma a cadeira antes de qualquer coisa, valha a jogada ou não
        if (m.botControlled) { reclaim(m); broadcast(); }
        if (msg.type === 'handToBot') {
          // só de quem está conectada e ainda joga por si (quem caiu tem o próprio prazo), e só com partida em curso
          const target = s.members.find((o) => o.id === msg.member);
          if (s.game.over || !target || target === m || target.bot || target.seat === null || !target.connected || target.botControlled) { refuse('illegal'); break; }
          if (now - target.lastActivity < IDLE_HANDOFF) { refuse('notIdle'); break; }
          takeover(target, 'idle', m.id);
          touch(m);
          broadcast();
          break;
        }
        if (msg.type === 'rematch') {
          if (!s.game.over) { refuse('illegal'); break; }
          s.members = s.members.filter((o) => !o.bot);
          for (const o of s.members) o.botControlled = false; // no lobby ninguém joga por ninguém
          s.game = null;
          s.phase = 'lobby';
          scheduleGame(s, now, rng);
          // quem caiu durante a partida segurou a cadeira até aqui; agora tem a tolerância de sempre para voltar
          for (const o of s.members) if (!o.connected && !s.timers.some((t) => t.kind === 'drop' && t.token === o.token)) s.timers.push({ kind: 'drop', token: o.token!, at: now + DISCONNECT_GRACE });
          touch(m);
          events.push({ type: 'rematch', id: m.id, nickname: m.nickname });
          broadcast();
          break;
        }
        if (!applyAction(s.game, m.seat, msg, rng)) { refuse('illegal'); break; }
        touch(m);
        afterAction();
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
      } else if (msg.type === 'scenery') {
        touch(m);
        if (s.scenery !== msg.scenery) { s.scenery = msg.scenery; broadcast(); }
      } else if (msg.type === 'start') {
        if (m.seat === null || !canStart(s)) break;
        fillWithBots(s, now);
        s.game = createGame(s.rules);
        s.phase = 'playing';
        for (const o of s.members) o.lastActivity = now; // os relógios de parada começam com a partida
        touch(m);
        events.push({ type: 'started', humans: s.members.filter((o) => o.seat !== null && !o.bot).length, bots: s.members.filter((o) => o.bot).length });
        newHand();
        afterAction();
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
      } else if (t.kind === 'drop') {
        const m = member(t.token);
        if (!m || m.connected) break;
        // durante a partida a cadeira continua da pessoa, mas um bot joga por ela até ela voltar (se já não joga, ou se a partida acabou, nada muda)
        if (s.phase === 'playing' && m.seat !== null) {
          if (!m.botControlled && !s.game!.over) { takeover(m, 'dropped'); broadcast(); }
          break;
        }
        s.members = s.members.filter((x) => x !== m);
        events.push({ type: 'left', id: m.id, nickname: m.nickname });
        broadcast();
      } else if (t.kind === 'bot') {
        // só se a vez ainda for deste bot: o timer pode ter vencido depois de a situação mudar
        if (s.phase !== 'playing' || !s.game || botToAct(s) !== t.seat) break;
        botAct(s.game, t.seat, rng);
        afterAction();
      } else if (t.kind === 'nextHand') {
        const g = s.game;
        if (s.phase !== 'playing' || !g || g.over || g.hand?.phase !== 'over') break;
        newHand();
        afterAction();
      }
      break;
    }
  }
  return { state: s, out, events };
}

/** Uma jogada de `seat` pelo motor; false = o motor recusou. A mão de dez é da dupla que decide: qualquer um dos dois decide. */
function applyAction(g: GameState, seat: Seat, msg: ClientMessage, rng: Rng): boolean {
  switch (msg.type) {
    case 'play': return playCard(g, seat, msg.id, msg.covered, rng);
    case 'raise': return raise(g, seat);
    case 'respond': return respond(g, seat, msg.action);
    case 'decideDez': return g.hand?.phase === 'dezDecision' && g.hand.decider === teamOf(seat) && decideDez(g, msg.action);
    default: return false;
  }
}

/**
 * Qual bot tem de agir agora, se algum (bot de verdade, ou o que joga pela cadeira de uma pessoa ausente). Na vaza é
 * quem tem a vez. Truco e mão de dez são da dupla: se alguém da dupla é gente presente, a pessoa responde (o bot
 * parceiro espera); numa dupla só de bots, a cadeira que o motor aponta.
 */
function botToAct(s: RoomState): Seat | null {
  const g = s.game!, h = g.hand;
  if (!h || g.over || h.phase === 'over') return null;
  const botAt = (seat: Seat) => s.members.some((m) => m.seat === seat && (m.bot || m.botControlled));
  if (h.phase === 'play') return botAt(h.turn) ? h.turn : null;
  const first = h.phase === 'respond' ? responderSeat(g) : TEAM_SEATS[h.decider!][0];
  return TEAM_SEATS[teamOf(first)].every(botAt) ? first : null;
}

function botAct(g: GameState, seat: Seat, rng: Rng) {
  const h = g.hand!;
  if (h.phase === 'dezDecision') decideDez(g, chooseBotDez(g, rng));
  else if (h.phase === 'respond') respond(g, seat, chooseBotResponse(g, seat, rng));
  else {
    const c = chooseBotPlay(g, seat, rng);
    if (c.kind === 'raise') raise(g, seat); else playCard(g, seat, c.id, c.covered, rng);
  }
}

/**
 * Troca os timers da mesa pelo que a situação pede agora: a mão seguinte, a vez de um bot, ou nada (gente ou fim de jogo).
 * A pausa entre mãos, uma vez marcada, não recomeça (uma tomada ou retomada no meio dela não a adia). O bot "pensa"
 * um tempo sorteado (`thinkTime`, vezes `pace.think`), e a primeira ação de uma mão ainda espera a coreografia de
 * dar as cartas (`pace.deal`): nenhuma tela a vê agir antes de ter as cartas na mão.
 */
function scheduleGame(s: RoomState, now: number, rng: Rng) {
  s.timers = s.timers.filter((t) => t.kind !== 'bot');
  const g = s.game, h = g?.hand;
  const pausing = h?.phase === 'over' && s.phase === 'playing';
  if (!pausing) s.timers = s.timers.filter((t) => t.kind !== 'nextHand');
  if (!g || !h || s.phase !== 'playing') return;
  if (h.phase === 'over') {
    if (!g.over && !s.timers.some((t) => t.kind === 'nextHand')) s.timers.push({ kind: 'nextHand', at: now + s.pace.handPause });
    return;
  }
  const seat = botToAct(s);
  if (seat === null) return;
  const think = Math.round(thinkTime(rng, h.phase === 'play' ? 'play' : 'decision') * s.pace.think);
  s.timers.push({ kind: 'bot', seat, at: now + (handUntouched(g) ? s.pace.deal : 0) + think });
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
    s.members.push({ id: `m${s.nextId++}`, token: null, nickname, connected: true, lastActivity: now, seat, bot: true, botControlled: false });
  }
}

/** Quem deve receber snapshot: membros conectados e visitantes. */
export function connectedTokens(s: RoomState): string[] {
  return [...s.members.filter((m) => m.connected && m.token !== null).map((m) => m.token!), ...s.visitors];
}

/**
 * A sala como este token a vê em `now`. Sem tokens; só ids públicos. Quem está sentado vê só as próprias cartas
 * (e as do parceiro na decisão da mão de dez); fantasma vê tudo ou nada conforme o toggle; visitante
 * (ainda sem apelido) não vê carta nenhuma. `idle` de cada pessoa é medido em `now`.
 */
export function snapshotFor(s: RoomState, token: string, now: number): RoomSnapshot {
  const me = s.members.find((m) => m.token === token);
  const from = perspectiveOf(s, token);
  return {
    code: s.code,
    phase: s.phase === 'playing' ? 'playing' : 'lobby',
    members: s.members.map((m) => ({ id: m.id, nickname: m.nickname, connected: m.connected, seat: m.seat, bot: m.bot, botControlled: m.botControlled, idle: m.bot ? 0 : Math.max(0, now - m.lastActivity) })),
    you: me?.id ?? null,
    teams: [...s.teams],
    rules: copyRules(s.game ? s.game.rules : s.rules),
    ghostsSeeCards: s.ghostsSeeCards,
    scenery: s.scenery,
    game: s.game ? viewFor(s.game, from) : null,
  };
}

/** De onde este token olha a partida: a própria cadeira; fantasma tudo ou nada conforme o toggle; visitante nada. */
function perspectiveOf(s: RoomState, token: string): Perspective {
  const me = s.members.find((m) => m.token === token);
  return me ? (me.seat ?? (s.ghostsSeeCards ? 'all' : 'none')) : 'none';
}

/** Regras são dado plano com uma lista dentro: copiar é não compartilhar a escada com ninguém. */
const copyRules = (r: Rules): Rules => ({ ...r, ladder: [...r.ladder] });

/** Identidade de um timer é o seu conteúdo: o adaptador usa a mesma chave para agendar e cancelar. */
export function timerKey(t: RoomTimer) { return `${t.kind}:${t.kind === 'drop' ? t.token : t.kind === 'bot' ? t.seat : ''}:${t.at}`; }

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
