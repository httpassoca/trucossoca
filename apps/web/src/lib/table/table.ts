import type { CardId, DezAction, GameEvent, GameState, RespondAction, Seat } from '@truco/rules';

/**
 * O que a mesa mostra a este cliente. É um objeto novo a cada mudança, nunca mutado no lugar,
 * então a interface pode reagir por identidade. Online, `game` chega do servidor só com as próprias cartas.
 */
export interface TableSnapshot {
  game: GameState;
  /** cadeira que esta pessoa controla agora */
  seat: Seat;
  /** de quem a mesa espera uma ação (pessoa ou bot); -1 = ninguém (mão encerrada, fim de jogo) */
  acting: Seat | -1;
  /** a próxima carta da cadeira local vai coberta */
  coverNext: boolean;
  /** a cadeira local pode trucar agora */
  canRaise: boolean;
  /** cobrir é permitido nesta vaza */
  canCover: boolean;
}

/** Chamado depois de cada mudança com o snapshot novo e os eventos que a causaram (vazio se só a intenção mudou). */
export type TableListener = (snapshot: TableSnapshot, events: GameEvent[]) => void;

/** Única porta entre a interface (cena, HUD, teclado) e o jogo — ADR 0003. Ações ilegais são ignoradas em silêncio. */
export interface Table {
  readonly snapshot: TableSnapshot;
  newGame(): void;
  /** joga pela cadeira local; `covered` default = `snapshot.coverNext` */
  play(id: CardId, covered?: boolean): void;
  raise(): void;
  respond(action: RespondAction): void;
  decideDez(action: DezAction): void;
  toggleCover(): void;
  subscribe(listener: TableListener): () => void;
  dispose(): void;
}
