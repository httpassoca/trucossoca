# Truco Mineiro

Jogo de Truco em 3D, primeira pessoa, jogado online entre amigos em salas, ou offline contra bots. Este glossário fixa o vocabulário do domínio; o código usa identificadores em inglês, indicados entre parênteses quando a tradução não é óbvia.

## Linguagem

### Mesa

**Mão** (`hand`):
Uma distribuição de cartas, do embaralhar até a pontuação. Vale os pontos da escada.
_Evitar_: rodada, partida, deal

**Vaza** (`trick`):
Uma volta da mesa em que cada cadeira joga uma carta. Uma mão tem até três vazas.
_Evitar_: rodada, round, turno

**Partida** (`game`):
A sequência de mãos até uma dupla atingir a pontuação alvo.
_Evitar_: jogo, match

**Cartas** (`cards`):
As cartas que uma cadeira segura durante a mão.
_Evitar_: mão (no sentido de cartas seguradas), hand

**Cadeira** (`seat`):
Uma das quatro posições na mesa. Uma cadeira é ocupada por uma pessoa ou por um bot.
_Evitar_: jogador, posição, slot

**Dupla** (`team`):
As duas cadeiras opostas que pontuam juntas. As duplas têm nome, editável por qualquer pessoa da sala.
_Evitar_: time, equipe, lado

**Mão** (posição) (`mao`):
A cadeira que abre a mão; gira uma cadeira por mão. A última cadeira a jogar é o **pé**.
_Evitar_: dealer, primeiro, opener

**Manilha** (`manilha`):
Carta de força fixa acima de todas as outras. No Mineiro: zap (4♣), sete de copas, espadilha (A♠), sete de ouros, nessa ordem.
_Evitar_: trunfo, curinga

**Coberta** (`covered`):
Carta jogada virada para baixo, sem força. Só permitida a partir da segunda vaza e nunca na mão de ferro.
_Evitar_: escondida, face down

### Apostas

**Escada** (`ladder`):
Os valores que uma mão pode assumir ao ser trucada: 2, 4, 6, 10, 12.
_Evitar_: níveis, stakes

**Trucar** (`raise`):
Propor o próximo degrau da escada. Em inglês, a ação é simplesmente "truco".
_Evitar_: pedir, aumentar, apostar

**Aceitar** (`accept`):
Concordar com o degrau trucado; a mão passa a valer esse degrau.
_Evitar_: topar, pagar

**Correr** (`decline`):
Recusar o degrau trucado; a dupla que trucou leva o valor anterior.
_Evitar_: fugir, desistir, fold

**Mão de dez** (`dez`):
Mão em que uma dupla está a dois pontos do alvo. Vale quatro, e a dupla decide antes de jogar se joga ou corre, podendo ver as cartas do parceiro.
_Evitar_: mão de onze (variante paulista)

**Mão de ferro** (`ferro`):
Mão em que as duas duplas estão a dois pontos do alvo. Jogada às cegas, sem cobertas.
_Evitar_: mão de onze cega

### Sala

**Sala** (`room`):
O lugar onde uma turma se reúne para jogar. Qualquer pessoa cria uma sala e entra por código ou link. Sobrevive ao fim da partida e morre depois de dez minutos sem atividade.
_Evitar_: lobby, mesa (a mesa é o objeto 3D dentro da sala), partida

**Apelido** (`nickname`):
O nome que uma pessoa escolhe ao entrar na sala. Não há conta nem cadastro.
_Evitar_: usuário, login, conta

**Fantasma** (`ghost`):
Pessoa na sala sem cadeira. Anda livremente pela mesa, é vista por todos e não interage com o jogo. Vê todas as cartas por padrão; a sala pode esconder.
_Evitar_: espectador, observador, viewer

**Bot** (`bot`):
Ocupante de cadeira controlado pelo servidor. Preenche cadeiras vazias e joga pela cadeira de quem cai (depois de vinte segundos) ou fica parada (depois de um minuto, quando outra pessoa sentada passa a cadeira), até a pessoa voltar ou agir; a cadeira continua sendo dela.
_Evitar_: IA, CPU, NPC

**Cadeira assumida** (`botControlled`):
Cadeira de uma pessoa por quem um bot joga no momento: ela caiu por vinte segundos (**tomada**, `botTakeover`), ou ficou parada por um minuto e outra pessoa sentada a **passou** a um bot (`handToBot`). Continua sendo dela: **retoma** (`reclaimed`) ao voltar ou ao agir.
_Evitar_: substituição, expulsão, kick, bot temporário

**Revanche** (`rematch`):
No fim de jogo, qualquer pessoa sentada pede revanche e a sala inteira volta ao lobby com as mesmas cadeiras, os mesmos nomes de dupla e as mesmas regras; os bots saem e voltam ao começar.
_Evitar_: nova partida (é o botão da mesa offline), restart, replay

**Variante** (`variant`):
Um conjunto nomeado de regras. Hoje só existe Truco Mineiro, com as regras individuais ajustáveis na sala.
_Evitar_: modo, preset
