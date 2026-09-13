/**
 * Mensagens trocadas entre cliente e servidor pelo WebSocket, nos dois sentidos, e o snapshot da sala
 * que cada pessoa recebe. Cliente e servidor importam daqui; nada é duplicado.
 */

/** Apelido: tamanho máximo depois de aparado. */
export const NICKNAME_MAX = 20;
/** O cliente manda `ping` neste intervalo; o servidor derruba quem fica o dobro em silêncio. */
export const PING_INTERVAL = 15_000;
export const SOCKET_IDLE_TIMEOUT = 30_000;

/** Códigos de fechamento do WebSocket que o cliente sabe explicar (4xxx = da aplicação, sem reconectar). */
export const CLOSE_ROOM_NOT_FOUND = 4404;
export const CLOSE_ROOM_ENDED = 4410;
export const CLOSE_REPLACED = 4409;

// cliente → servidor
export type ClientMessage =
  | { type: 'join'; nickname: string }
  | { type: 'nickname'; nickname: string }
  | { type: 'ping' };

// servidor → cliente
export type ServerMessage =
  | { type: 'snapshot'; snapshot: RoomSnapshot }
  | { type: 'pong' };

export interface RoomMemberView {
  /** id público e estável dentro da sala; nunca o token */
  id: string;
  nickname: string;
  connected: boolean;
}

/** Estado inteiro da sala como esta pessoa o vê. Chega inteiro a cada mudança; o cliente nunca faz diff. */
export interface RoomSnapshot {
  code: string;
  members: RoomMemberView[];
  /** id desta pessoa entre os membros; null enquanto ainda não entrou com apelido */
  you: string | null;
}

/** Lê uma mensagem crua do cliente. Devolve null para qualquer coisa fora do protocolo. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  switch (m.type) {
    case 'ping': return { type: 'ping' };
    case 'join':
    case 'nickname':
      if (typeof m.nickname !== 'string' || m.nickname.length > NICKNAME_MAX * 4) return null;
      return { type: m.type, nickname: m.nickname };
    default: return null;
  }
}
