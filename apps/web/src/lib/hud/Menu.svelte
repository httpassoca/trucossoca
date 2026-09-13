<script lang="ts">
  import type { Snippet } from 'svelte';
  import { canCycleSeats, newGame } from '../controller';
  import { SCENERIES, type SceneryId } from '@truco/protocol';
  import { t } from '../i18n.svelte';
  import { rememberedMenuGroups, rememberMenuGroup, rememberScenery, type MenuGroup } from '../identity';
  import { resume } from '../input';
  import { navigate } from '../route.svelte';
  import { live, setRules, ui } from '../state.svelte';
  import Kbd from './Kbd.svelte';
  import LangSwitch from './LangSwitch.svelte';
  import RulesForm from './RulesForm.svelte';
  import Seg from './Seg.svelte';
  import Switch from './Switch.svelte';

  /** `room`: a seção da sala (quem está, passar cadeira), que só a tela online sabe montar */
  let { room }: { room?: Snippet } = $props();
  const snap = $derived(live.snap);
  const sceneryOptions = $derived(SCENERIES.map((s) => [s, t(`scenery.${s}`)] as [SceneryId, string]));
  /** offline troca na hora e fica lembrado; online o cenário é da sala e só muda no lobby */
  function pickScenery(s: SceneryId) { rememberScenery(s); live.table?.setScenery(s); }

  /**
   * Os grupos do menu, um acordeão de vários abertos ao mesmo tempo. Cada um lembra no navegador se ficou aberto.
   * Sem nada lembrado: a sala aberta, os comandos abertos só na primeira vez (e fechados daí em diante), o resto fechado.
   */
  const stored = rememberedMenuGroups();
  const open = $state<Record<MenuGroup, boolean>>({ room: stored.room ?? true, keys: stored.keys ?? true, rules: stored.rules ?? false, scenery: stored.scenery ?? false, ui: stored.ui ?? false });
  if (stored.keys === undefined) rememberMenuGroup('keys', false);
  function toggle(g: MenuGroup) { open[g] = !open[g]; rememberMenuGroup(g, open[g]); }

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

  const shortcuts = $derived([
    ...(snap.seat === null ? [{ group: t('keys.group.ghost'), rows: [[t('keys.walk'), ['W', 'A', 'S', 'D']], [t('keys.look'), [t('kbd.mouse')]], [t('keys.jump'), [t('kbd.space')]], [t('keys.nextSeat'), ['Tab']], [t('keys.sitBot'), [t('kbd.shift')]]] }] : []),
    { group: t('keys.group.table'), rows: [
      [t('keys.look'), [t('kbd.mouse')]], [t('keys.zoom'), [t('kbd.rightClick')]], [t('keys.peek'), [t('kbd.shift')]], [t('keys.pick'), ['←', '→']], [t('keys.playPicked'), ['↵']],
      [t('keys.playDirect'), ['1', '2', '3']], [t('keys.raise'), ['T']], [t('keys.cover'), ['C']],
      [t('keys.jump'), [t('kbd.space')]], [t('keys.standUp'), [t('kbd.space'), t('kbd.space')]], [t('keys.walk'), ['W', 'A', 'S', 'D']], [t('keys.sit'), [t('kbd.shift')]],
      ...(canCycleSeats(snap) ? [[t('keys.otherSeat'), ['Tab']] as [string, string[]]] : []),
    ] },
    { group: t('keys.group.truco'), rows: [[t('keys.accept'), ['↵']], [t('keys.decline'), ['X']], [t('keys.raiseMore'), ['R']]] },
    { group: t('keys.group.menu'), rows: [[t('keys.menu'), ['Esc']]] },
  ] as { group: string; rows: [string, string[]][] }[]);
</script>

<!-- um grupo do acordeão, no contrato de markup do dssoca: cabeça com título e chevron, painel escondido quando fechado -->
{#snippet group(id: MenuGroup, title: string, hint: string, body: Snippet)}
  <div class="item" class:open={open[id]}>
    <h3 class="heading">
      <button class="head" type="button" aria-expanded={open[id]} aria-controls="tm-menu-{id}" onclick={() => toggle(id)}>
        <span class="title">{title}</span>
        {#if hint}<span class="hint">{hint}</span>{/if}
        <span class="chevron" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4l4 4 4-4" /></svg></span>
      </button>
    </h3>
    <div class="panel" id="tm-menu-{id}" hidden={!open[id]}><div class="panel-clip"><div class="panel-inner">{@render body()}</div></div></div>
  </div>
{/snippet}

{#snippet keysBody()}
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
{/snippet}

{#snippet rulesBody()}
  {#if !snap.rulesEditable}
    <RulesForm rules={snap.game.rules} readonly />
  {:else}
    <RulesForm rules={ui.rules} onchange={setRules} />
    <div class="tm-rules" style="margin-top:6px">
      <div class="tm-line">
        <span>{t('menu.botsPlay')}</span>
        <Switch label={t('menu.botsPlay')} on={ui.bots} ontoggle={(v) => (ui.bots = v)} />
      </div>
      <div class="tm-line"><span>{t('menu.pace')}</span><Seg value={ui.botPace} options={[[0.5, t('pace.fast')], [1, t('pace.normal')], [2, t('pace.slow')]]} onselect={(v) => (ui.botPace = v)} /></div>
    </div>
  {/if}
{/snippet}

{#snippet sceneryBody()}
  <Seg value={snap.scenery} options={sceneryOptions} disabled={!snap.rulesEditable} onselect={pickScenery} />
{/snippet}

{#snippet uiBody()}
  <div class="tm-rules">
    <div class="tm-line"><span>{t('lang.label')}</span><LangSwitch /></div>
    <div class="tm-line"><span>{t('menu.theme')}</span><Seg value={theme} options={[['dark', t('theme.dark')], ['light', t('theme.light')]]} onselect={(v) => (theme = v)} /></div>
    <div class="tm-line"><span>{t('menu.accent')}</span><Seg value={accent} options={[['', t('accent.green')], ['yellow', t('accent.amber')], ['cyan', t('accent.cyan')], ['magenta', t('accent.magenta')], ['red', t('accent.red')]]} onselect={(v) => (accent = v)} /></div>
    <div class="tm-line"><span>{t('menu.size')}</span><Seg value={size} options={[['sm', 'sm'], ['md', 'md'], ['lg', 'lg']]} onselect={(v) => (size = v)} /></div>
  </div>
{/snippet}

{#if ui.menuOpen}
  <div class="tm-backdrop">
    <div class="ss-card elevated tm-menu" data-size-variant="sm">
      <div class="head">
        <div class="heading"><span class="title">truco mineiro</span><span class="desc">{snap.rulesEditable ? t('menu.offlineDesc') : t('menu.lockedDesc')}</span></div>
        <span class="meta">esc</span>
      </div>
      <div class="body">
        <div class="ss-accordion tm-acc" data-size-variant="sm">
          {#if room}{@render group('room', t('menu.group.room'), '', room)}{/if}
          {@render group('keys', t('menu.keyboard'), '', keysBody)}
          {@render group('rules', t('menu.rules'), snap.rulesEditable ? t('menu.rulesNextHand') : t('menu.rulesInForce'), rulesBody)}
          {@render group('scenery', t('scenery.label'), t(`scenery.${snap.scenery}`), sceneryBody)}
          {@render group('ui', t('menu.interface'), '', uiBody)}
        </div>
      </div>
      <div class="foot">
        <button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>{t('nav.home')}</button>
        {#if snap.restart}<button class="ss-btn ghost" type="button" onclick={() => { newGame(); resume(); }}>{snap.restart === 'newGame' ? t('menu.newGame') : t('menu.rematch')}</button>{/if}
        <button class="ss-btn primary" type="button" onclick={resume}>{snap.seat === null ? t('menu.watch') : t('menu.play')} <Kbd keys={['↵']} /></button>
      </div>
    </div>
  </div>
{/if}
