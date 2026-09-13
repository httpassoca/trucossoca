# Truco Mineiro — mesa 3D co-op

Jogo de Truco Mineiro em 3D, primeira pessoa, 2v2. Salas online com amigos (por enquanto só entrar e se ver na sala) e a mesa offline contra bots.

```
bun install
bun run dev      # servidor Bun em :3000 + Vite em http://localhost:5173 (com proxy de /api e /ws)
bun test         # regras, protocolo, sala, mesa local e mesa remota
bun run check    # svelte-check + tsc do servidor e do protocolo
bun run build    # cliente em apps/web/dist
bun run start    # servidor servindo o cliente buildado (PORT=3000)
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

packages/protocol  mensagens cliente ↔ servidor (uniões discriminadas nos dois sentidos), `RoomSnapshot`,
                   `parseClientMessage`, códigos de fechamento do WebSocket. Importado pelos dois lados.

apps/server      Bun.serve: HTTP (`/health`, `POST /api/rooms`, cliente estático com fallback SPA) e WebSocket em `/ws`
  src/room.ts      máquina de estado da sala, pura: `step(state, input, now)` → estado novo, mensagens por token,
                   eventos para o log; timers como dado em `state.timers` (morte em 10 min, saída 20 s após cair)
  src/host.ts      `RoomHost`: sockets por token, agenda os timers que a sala pede e nunca os seus
  src/rooms.ts     `Rooms`: as salas vivas num mapa em memória (ADR 0004), códigos de 4 letras
  src/server.ts    rotas e upgrade; sala inexistente fecha o socket com `CLOSE_ROOM_NOT_FOUND`
  test/            bun test: sala (entrar, sufixo, cair, voltar, morrer) e um servidor real numa porta livre

apps/web         Vite + Svelte 5 + Threlte 8 + three, HUD em dssoca
  src/lib/route.svelte.ts   rotas: `/` início, `/sala/CODE`, `/offline`
  src/lib/screens/          Home (abrir sala, entrar com código, offline), Room (código, link, apelido, quem está na sala), Offline (a mesa)
  src/lib/identity.ts       token por aba (sessionStorage) e apelido lembrado (localStorage)
  src/lib/table/table.ts    interface `Table` (ADR 0003): snapshot imutável, cadeira local, ações, assinatura de eventos
  src/lib/table/local.ts    `LocalTable`: motor e bots no navegador, com ritmo dos bots e pausa entre mãos (timers injetáveis)
  src/lib/table/remote.ts   `RemoteTable`: conecta na sala com o token, aplica snapshots, reconecta com espera crescente, pinga
  src/lib/state.svelte.ts   estado reativo: `table`, `live.snap` (espelho do snapshot) e `ui` (câmera, seleção, menu, regras)
  src/lib/controller.ts     cola entre a mesa e a interface: log, falas, câmera, prompt derivado do snapshot
  src/lib/input.ts          teclado + pointer lock — só fala com `Table`
  test/                     bun test: `LocalTable` joga uma partida inteira contra bots sem DOM; `RemoteTable` com socket falso
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
- Rede: a sala já existe (entrar, apelido, quem está); cadeiras, duplas e a partida online vêm nas próximas issues do spec #1.
- Onde a carta empatada cai (ao lado × cruzada por cima) — confirmar com a mesa de Minas.
