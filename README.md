# Truco Mineiro — mesa 3D co-op

Jogo de Truco Mineiro em 3D, primeira pessoa, 2v2. Por enquanto local com bots; a rede vem depois.

```
bun install
bun run dev      # apps/web em http://localhost:5173
bun test         # regras (packages/rules)
bun run check    # svelte-check
bun run build
```

## Estrutura

```
packages/rules   motor puro em TypeScript — sem DOM, sem three.js. Vai virar a autoridade do servidor.
  src/types.ts     tipos (Rules, GameState, HandState, Play, GameEvent…) — nomes do glossário em CONTEXT.md:
                   `hand` = mão, `trick` = vaza (evento `trick`), `cards` = cartas que cada cadeira segura
  src/cards.ts     baralho de 40, força das cartas, manilhas fixas
  src/engine.ts    createGame / startHand / playCard (fecha a vaza com 4 cartas) / raise / respond / decideDez / handWinner
  src/bot.ts       decisões dos bots (só olham as próprias cartas)
  test/            bun test

apps/web         Vite + Svelte 5 + Threlte 8 + three, HUD em dssoca
  src/lib/state.svelte.ts   estado reativo: `game` (motor) e `ui` (câmera, seleção, prompts, menu)
  src/lib/controller.ts     única porta de mutação do jogo: aplica ações, drena eventos, agenda bots
  src/lib/input.ts          teclado + pointer lock
  src/lib/format.ts         eventos → texto (PT-BR)
  src/lib/scene/            builders (personagens/cartas procedurais), throw (onde a carta cai), layout, gaze, World.svelte
  src/lib/hud/              Score, Seats, Keys, Log, Prompt, Menu (markup vanilla do dssoca)
```

## Decisões

- **Regras configuráveis** em `Rules`; defaults = Truco Mineiro (Copag): manilhas fixas 4♣ > 7♥ > A♠ > 7♦,
  escada 2 → 4 → 6 → 10 → 12, mão de dez (vale 4, parceiro mostra as cartas), mão de ferro às cegas,
  empate nas três vazas não pontua. Alterações no menu aplicam na próxima mão.
- **Eventos, não texto.** O motor emite `GameEvent`s estruturados; o cliente formata e anima.
  Um servidor autoritativo replica exatamente isso por WebSocket.
- **Cartas na mesa** caem "humanamente": `lead` perto do centro, `kill` em cima da carta que mata
  (puxada para quem jogou e atravessada), `tie` ao lado, `lose` e `cover` perto do jogador e tortas.
  Vazas passadas escurecem. O sorteio de posição fica no cliente (`scene/throw.ts`), não no motor.
- **Teclado primeiro.** Mouse só para olhar (pointer lock). Esc solta o mouse e abre o menu.
- **dssoca** via `theme.css` + `vanilla.css` com o contrato de markup dos componentes Svelte —
  trocar por `import { Button } from 'dssoca'` é 1:1 quando quiser. Menu expõe os dois eixos
  (`data-theme`, `data-size-variant`) e um override de `--ss-accent`.

## Pendente

- `vanilla.css` do dssoca@0.17 tem `:where(:scope)a.ss-svc` que o lightningcss (Vite 8) rejeita;
  `build.cssMinify` está desligado até isso ser corrigido no dssoca.
- Rede: `services/server` (Bun + WebSocket) rodando `@truco/rules`; clientes recebem só a própria mão.
- Onde a carta empatada cai (ao lado × cruzada por cima) — confirmar com a mesa de Minas.
