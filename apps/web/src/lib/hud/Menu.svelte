<script lang="ts">
  import type { Rules } from '@truco/rules';
  import { newGame } from '../controller';
  import { resume } from '../input';
  import { navigate } from '../route.svelte';
  import { ui } from '../state.svelte';
  import Kbd from './Kbd.svelte';

  // dois eixos do dssoca + override do token --ss-accent
  const ACCENTS: Record<string, string> = { '': '', yellow: 'var(--ss-yellow)', cyan: 'var(--ss-cyan)', magenta: 'var(--ss-magenta)', red: 'var(--ss-red)' };
  let theme = $state<'dark' | 'light'>('dark');
  let size = $state<'sm' | 'md' | 'lg'>('md');
  let accent = $state('');
  $effect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme; root.dataset.sizeVariant = size;
    if (ACCENTS[accent]) root.style.setProperty('--ss-accent', ACCENTS[accent]); else root.style.removeProperty('--ss-accent');
  });

  type BoolRule = { [K in keyof Rules]: Rules[K] extends boolean ? K : never }[keyof Rules];
  const switches: { key: BoolRule; label: string }[] = [
    { key: 'raiseOnlyOnTurn', label: 'Trucar só na sua vez' },
    { key: 'alternateRaises', label: 'Aumentos alternam entre duplas' },
    { key: 'allowCovered', label: 'Carta coberta permitida' },
    { key: 'maoDeDezPeek', label: 'Mão de dez: olhar carta do parceiro' },
    { key: 'maoDeFerroBlind', label: 'Mão de ferro às cegas' },
    { key: 'allTieNobody', label: 'Empate nas 3 vazas: ninguém pontua' },
  ];
  const shortcuts = [
    { group: 'na mesa', rows: [
      ['Olhar ao redor', ['mouse']], ['Escolher carta', ['←', '→']], ['Jogar a carta escolhida', ['↵', 'espaço']],
      ['Jogar direto', ['1', '2', '3']], ['Pedir truco / seis / dez / doze', ['T']], ['Cobrir a próxima carta', ['C']], ['Trocar de cadeira (debug)', ['Tab']],
    ] },
    { group: 'quando pedem truco', rows: [['Aceitar / jogar', ['↵']], ['Correr', ['X']], ['Pedir mais', ['R']]] },
    { group: 'menu', rows: [['Abrir / fechar este menu, soltar o mouse', ['Esc']]] },
  ] as { group: string; rows: [string, string[]][] }[];
</script>

{#snippet seg<T extends string | number>(value: T, options: [T, string][], set: (v: T) => void)}
  <div class="ss-segmented" role="radiogroup">
    {#each options as [v, label]}
      <button type="button" role="radio" class="segment" class:selected={value === v} aria-checked={value === v} onclick={() => set(v)}>{label}</button>
    {/each}
  </div>
{/snippet}

{#if ui.menuOpen}
  <div class="tm-backdrop">
    <div class="ss-card elevated tm-menu" data-size-variant="sm">
      <div class="head">
        <div class="heading"><span class="title">truco mineiro</span><span class="desc">mesa 3D · preview local com bots</span></div>
        <span class="meta">esc</span>
      </div>
      <div class="body">
        <div>
          <div class="tm-section"><h4>Tema</h4>{@render seg(theme, [['dark', 'escuro'], ['light', 'claro']], (v) => (theme = v))}</div>
          <div class="tm-section"><h4>Destaque</h4>{@render seg(accent, [['', 'verde'], ['yellow', 'âmbar'], ['cyan', 'ciano'], ['magenta', 'magenta'], ['red', 'vermelho']], (v) => (accent = v))}</div>
          <div class="tm-section"><h4>Tamanho</h4>{@render seg(size, [['sm', 'sm'], ['md', 'md'], ['lg', 'lg']], (v) => (size = v))}</div>
          <div class="tm-section">
            <h4>Regras <span style="text-transform:none;letter-spacing:0">(aplicam na próxima mão)</span></h4>
            <div class="tm-rules">
              {#each switches as s (s.key)}
                <div class="tm-line">
                  <span>{s.label}</span>
                  <label class="ss-switch"><button type="button" role="switch" class="track" aria-label={s.label} class:on={ui.rules[s.key]} aria-checked={ui.rules[s.key]} onclick={() => (ui.rules[s.key] = !ui.rules[s.key])}><span class="thumb"></span></button></label>
                </div>
              {/each}
              <div class="tm-line"><span>Cobrir a partir da vaza</span>{@render seg(ui.rules.coverFromTrick, [[1, '1ª'], [2, '2ª']], (v) => (ui.rules.coverFromTrick = v))}</div>
              <div class="tm-line"><span>Após empate, quem sai</span>{@render seg(ui.rules.tieLeader, [['mao', 'o mão'], ['leader', 'quem saiu']], (v) => (ui.rules.tieLeader = v))}</div>
              <div class="tm-line">
                <span>Bots jogam as outras cadeiras</span>
                <label class="ss-switch"><button type="button" role="switch" class="track" aria-label="Bots jogam as outras cadeiras" class:on={ui.bots} aria-checked={ui.bots} onclick={() => (ui.bots = !ui.bots)}><span class="thumb"></span></button></label>
              </div>
              <div class="tm-line"><span>Ritmo dos bots</span>{@render seg(ui.botDelay, [[350, 'rápido'], [800, 'normal'], [1500, 'lento']], (v) => (ui.botDelay = v))}</div>
            </div>
            <div class="tm-hint">Manilhas fixas: 4♣ &gt; 7♥ &gt; A♠ &gt; 7♦ · escada 2 → 4 → 6 → 10 → 12</div>
          </div>
        </div>
        <div>
          <div class="tm-section">
            <h4>Teclado</h4>
            <div class="ss-shortcuts-help">
              {#each shortcuts as g}
                <div class="group">
                  <h3 class="gname">{g.group}</h3>
                  <ul class="rows tm-rows">
                    {#each g.rows as [label, keys]}
                      <li class="row"><span class="label">{label}</span><span class="keys"><Kbd {keys} or={keys[0] === '↵' && keys.length === 2} /></span></li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
      <div class="foot">
        <button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>Início</button>
        <button class="ss-btn ghost" type="button" onclick={() => { newGame(); resume(); }}>Nova partida</button>
        <button class="ss-btn primary" type="button" onclick={resume}>Jogar <Kbd keys={['↵']} /></button>
      </div>
    </div>
  </div>
{/if}
