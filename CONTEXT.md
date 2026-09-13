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
As cartas que uma cadeira segura durante a mão. Ficam na mão de quem senta, baixas e viradas para baixo; a pessoa segura uma tecla para **olhar** (`peek`) as suas, e todo mundo vê que ela está olhando. Quem se levanta deixa as suas na mesa, na frente da cadeira.
_Evitar_: mão (no sentido de cartas seguradas), hand

**Cadeira** (`seat`):
Uma das quatro posições na mesa. Uma cadeira é ocupada por uma pessoa ou por um bot.
_Evitar_: jogador, posição, slot

**Dupla** (`team`):
As duas cadeiras opostas que pontuam juntas. As duplas têm nome, editável por qualquer pessoa da sala.
_Evitar_: time, equipe, lado

**Mão** (posição) (`mao`):
A cadeira que abre a mão: a da direita do carteador. A última cadeira a jogar é o **pé**, que é o próprio carteador.
_Evitar_: primeiro, opener

**Carteador** (`dealer`):
A cadeira que embaralha e dá as cartas da mão. Sorteada na primeira mão de cada partida e de cada revanche; depois passa para a direita a cada mão, ou seja, a mão de uma rodada é o carteador da seguinte. Quem está à sua esquerda **corta** (`cut`) o baralho; o carteador dá uma carta por vez, começando pela direita, até cada cadeira ter três. É o pé da mão que dá. Ninguém aperta nada para embaralhar, cortar ou dar: acontece sozinho.
_Evitar_: dealer (em português), distribuidor, banca, quem dá

**Monte** (`stock`):
As cartas que sobram depois de dar as três de cada cadeira. Fica na mesa na frente da mão, que será o próximo carteador. Ninguém vê o que tem nele.
_Evitar_: baralho (é o conjunto das 40), pilha, deck, resto

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

**Cenário** (`scenery`):
O lugar ao redor da mesa: o chão, o que se vê em volta, a luz, a mesa e as cadeiras, e o desenho do baralho. É escolhido por sala, no lobby, por qualquer pessoa, e fica trancado enquanto uma partida corre; offline, é escolhido na tela e lembrado no navegador. Hoje existem dois: o **bar de praia** (`bar`), o padrão, um boteco na areia no fim de tarde, e o **cemitério** (`graveyard`), uma noite gótica sob a lua de sangue.
_Evitar_: mapa, map, fase, level, tema, skin, mundo

**Apelido** (`nickname`):
O nome que uma pessoa escolhe ao entrar na sala. Não há conta nem cadastro.
_Evitar_: usuário, login, conta

**Fantasma** (`ghost`):
Pessoa na sala sem cadeira. Anda livremente pela mesa, é vista por todos e não interage com o jogo. Vê todas as cartas por padrão; a sala pode esconder. Entre mãos, pode sentar no lugar de um bot e entrar na partida. Offline, é quem escolhe assistir uma mesa de quatro bots; senta do mesmo jeito.
_Evitar_: espectador, observador, viewer

**Boneco** (`buddy`):
O corpo de quem está na mesa, pessoa ou bot. Quem senta aparece sentado na cadeira; um fantasma anda por aí, e todos o veem. O boneco fala, olha, reage ao jogo e veste um molho.
_Evitar_: avatar, personagem, modelo, skin, char

**Molho** (`outfit`):
O visual de um boneco: cor, chapéu, cabelo, barba, óculos, roupa, calçado e o que segura nas mãos. Vem do apelido: o mesmo apelido tem o mesmo molho em toda tela e toda sala, sem ninguém escolher nada.
_Evitar_: traje, roupa, visual, skin, preset, outfit (em português)

**Presença** (`presence`):
Onde uma pessoa está na mesa (inclusive a altura, quando pula) e para onde olha. Sai de cada aba até dez vezes por segundo e chega às outras por fora do estado da sala; não conta como atividade. De um fantasma ou de quem está de pé, os outros usam a posição e o olhar; de quem senta, o olhar, quanto **se inclina** (`lean`) sobre a mesa e se está **olhando as cartas** (`peek`).
_Evitar_: posição, tracking, telemetria

**De pé** (`standing`):
Pessoa sentada que se levantou da cadeira. Anda e pula pela mesa como um fantasma, sobe na mesa se quiser, e continua jogando pela cadeira dela, que fica com as cartas na frente da cadeira vazia. Senta de novo quando volta para perto da cadeira. Ficar de pé não conta como atividade.
_Evitar_: fantasma, passear, AFK

**Bot** (`bot`):
Ocupante de cadeira controlado pelo servidor. Preenche cadeiras vazias e joga pela cadeira de quem cai (depois de vinte segundos) ou fica parada (depois de um minuto, quando outra pessoa sentada passa a cadeira), até a pessoa voltar ou agir; a cadeira continua sendo dela.
_Evitar_: IA, CPU, NPC

**Cadeira assumida** (`botControlled`):
Cadeira de uma pessoa por quem um bot joga no momento: ela caiu por vinte segundos (**tomada**, `botTakeover`), ou ficou parada por um minuto e outra pessoa sentada a **passou** a um bot (`handToBot`). Continua sendo dela: **retoma** (`reclaimed`) ao voltar ou ao agir.
_Evitar_: substituição, expulsão, kick, bot temporário

**Revanche** (`rematch`):
No fim de jogo, qualquer pessoa sentada pede revanche e a sala inteira volta ao lobby com as mesmas cadeiras, os mesmos nomes de dupla e as mesmas regras; os bots saem e voltam ao começar.
_Evitar_: nova partida (é o botão da mesa offline), restart, replay

**Idioma** (`lang`):
A língua da interface, escolhida por navegador e lembrada entre visitas. Português é o padrão; inglês é a outra. Toda frase que a pessoa lê passa por uma tabela só. As **chamadas** ("Truco!", "Seis!", "Dez!", "Doze!", "Corro!") e os nomes das mãos especiais ficam em português nas duas línguas.
_Evitar_: locale, tradução (é o mecanismo, não a escolha)

**Dica** (`hint`):
A explicação curta em inglês de uma chamada ou mão especial, dada no log na primeira vez que ela aparece para quem lê em inglês, e nunca mais nesse navegador.
_Evitar_: tooltip, glossário, tutorial

**Variante** (`variant`):
Um conjunto nomeado de regras. Hoje só existe Truco Mineiro, com as regras individuais ajustáveis na sala.
_Evitar_: modo, preset
