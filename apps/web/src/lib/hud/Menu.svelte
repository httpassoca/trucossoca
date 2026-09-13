<script lang="ts">
  import { newGame } from '../controller';
  import { resume } from '../input';
  import { navigate } from '../route.svelte';
  import { live, ui } from '../state.svelte';
  import Kbd from './Kbd.svelte';
  import RulesForm from './RulesForm.svelte';
  import Seg from './Seg.svelte';
  import Switch from './Switch.svelte';

  const snap = $derived(live.snap);

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

  const shortcuts = [
    { group: 'na mesa', rows: [
      ['Olhar ao redor', ['mouse']], ['Escolher carta', ['←', '→']], ['Jogar a carta escolhida', ['↵', 'espaço']],
      ['Jogar direto', ['1', '2', '3']], ['Pedir truco / seis / dez / doze', ['T']], ['Cobrir a próxima carta', ['C']], ['Olhar de outra cadeira', ['Tab']],
    ] },
    { group: 'quando pedem truco', rows: [['Aceitar / jogar', ['↵']], ['Correr', ['X']], ['Pedir mais', ['R']]] },
    { group: 'menu', rows: [['Abrir / fechar este menu, soltar o mouse', ['Esc']]] },
  ] as { group: string; rows: [string, string[]][] }[];
</script>

{#if ui.menuOpen}
  <div class="tm-backdrop">
    <div class="ss-card elevated tm-menu" data-size-variant="sm">
      <div class="head">
        <div class="heading"><span class="title">truco mineiro</span><span class="desc">{snap.rulesEditable ? 'mesa offline contra bots' : 'regras trancadas até o fim da partida'}</span></div>
        <span class="meta">esc</span>
      </div>
      <div class="body">
        <div>
          <div class="tm-section"><h4>Tema</h4><Seg value={theme} options={[['dark', 'escuro'], ['light', 'claro']]} onselect={(v) => (theme = v)} /></div>
          <div class="tm-section"><h4>Destaque</h4><Seg value={accent} options={[['', 'verde'], ['yellow', 'âmbar'], ['cyan', 'ciano'], ['magenta', 'magenta'], ['red', 'vermelho']]} onselect={(v) => (accent = v)} /></div>
          <div class="tm-section"><h4>Tamanho</h4><Seg value={size} options={[['sm', 'sm'], ['md', 'md'], ['lg', 'lg']]} onselect={(v) => (size = v)} /></div>
          <div class="tm-section">
            {#if !snap.rulesEditable}
              <h4>Regras <span style="text-transform:none;letter-spacing:0">(em vigor nesta partida)</span></h4>
              <RulesForm rules={snap.game.rules} readonly />
            {:else}
              <h4>Regras <span style="text-transform:none;letter-spacing:0">(aplicam na próxima mão)</span></h4>
              <RulesForm rules={ui.rules} onchange={(r) => (ui.rules = r)} />
              <div class="tm-rules" style="margin-top:6px">
                <div class="tm-line">
                  <span>Bots jogam as outras cadeiras</span>
                  <Switch label="Bots jogam as outras cadeiras" on={ui.bots} ontoggle={(v) => (ui.bots = v)} />
                </div>
                <div class="tm-line"><span>Ritmo dos bots</span><Seg value={ui.botDelay} options={[[350, 'rápido'], [800, 'normal'], [1500, 'lento']]} onselect={(v) => (ui.botDelay = v)} /></div>
              </div>
            {/if}
          </div>
        </div>
        <div>
          <div class="tm-section">
            <h4>Teclado</h4>
            <div class="ss-shortcuts-help">
              {#each shortcuts as g (g.group)}
                <div class="group">
                  <h3 class="gname">{g.group}</h3>
                  <ul class="rows tm-rows">
                    {#each g.rows as [label, keys] (label)}
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
        {#if snap.canRestart}<button class="ss-btn ghost" type="button" onclick={() => { newGame(); resume(); }}>Nova partida</button>{/if}
        <button class="ss-btn primary" type="button" onclick={resume}>{snap.seat === null ? 'Olhar' : 'Jogar'} <Kbd keys={['↵']} /></button>
      </div>
    </div>
  </div>
{/if}
