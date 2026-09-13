<script lang="ts">
  import type { Snippet } from 'svelte';
  import { canCycleSeats, newGame } from '../controller';
  import { SCENERIES, type SceneryId } from '@truco/protocol';
  import { t } from '../i18n.svelte';
  import { rememberScenery } from '../identity';
  import { resume } from '../input';
  import { navigate } from '../route.svelte';
  import { live, ui } from '../state.svelte';
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
    ...(snap.seat === null ? [{ group: t('keys.group.ghost'), rows: [[t('keys.walk'), ['W', 'A', 'S', 'D']], [t('keys.look'), [t('kbd.mouse')]], [t('keys.jump'), [t('kbd.space')]], [t('keys.nextSeat'), ['Tab']]] }] : []),
    { group: t('keys.group.table'), rows: [
      [t('keys.look'), [t('kbd.mouse')]], [t('keys.zoom'), [t('kbd.rightClick')]], [t('keys.pick'), ['←', '→']], [t('keys.playPicked'), ['↵']],
      [t('keys.playDirect'), ['1', '2', '3']], [t('keys.raise'), ['T']], [t('keys.cover'), ['C']],
      [t('keys.jump'), [t('kbd.space')]], [t('keys.standUp'), [t('kbd.space'), t('kbd.space')]], [t('keys.walk'), ['W', 'A', 'S', 'D']], [t('keys.sit'), [t('kbd.shift')]],
      ...(canCycleSeats(snap) ? [[t('keys.otherSeat'), ['Tab']] as [string, string[]]] : []),
    ] },
    { group: t('keys.group.truco'), rows: [[t('keys.accept'), ['↵']], [t('keys.decline'), ['X']], [t('keys.raiseMore'), ['R']]] },
    { group: t('keys.group.menu'), rows: [[t('keys.menu'), ['Esc']]] },
  ] as { group: string; rows: [string, string[]][] }[]);
</script>

{#if ui.menuOpen}
  <div class="tm-backdrop">
    <div class="ss-card elevated tm-menu" data-size-variant="sm">
      <div class="head">
        <div class="heading"><span class="title">truco mineiro</span><span class="desc">{snap.rulesEditable ? t('menu.offlineDesc') : t('menu.lockedDesc')}</span></div>
        <span class="meta">esc</span>
      </div>
      <div class="body">
        <div>
          {#if room}<div class="tm-section">{@render room()}</div>{/if}
          <div class="tm-section"><h4>{t('lang.label')}</h4><LangSwitch /></div>
          <div class="tm-section"><h4>{t('menu.theme')}</h4><Seg value={theme} options={[['dark', t('theme.dark')], ['light', t('theme.light')]]} onselect={(v) => (theme = v)} /></div>
          <div class="tm-section"><h4>{t('menu.accent')}</h4><Seg value={accent} options={[['', t('accent.green')], ['yellow', t('accent.amber')], ['cyan', t('accent.cyan')], ['magenta', t('accent.magenta')], ['red', t('accent.red')]]} onselect={(v) => (accent = v)} /></div>
          <div class="tm-section"><h4>{t('menu.size')}</h4><Seg value={size} options={[['sm', 'sm'], ['md', 'md'], ['lg', 'lg']]} onselect={(v) => (size = v)} /></div>
          <div class="tm-section"><h4>{t('scenery.label')}</h4><Seg value={snap.scenery} options={sceneryOptions} disabled={!snap.rulesEditable} onselect={pickScenery} /></div>
          <div class="tm-section">
            {#if !snap.rulesEditable}
              <h4>{t('menu.rules')} <span style="text-transform:none;letter-spacing:0">{t('menu.rulesInForce')}</span></h4>
              <RulesForm rules={snap.game.rules} readonly />
            {:else}
              <h4>{t('menu.rules')} <span style="text-transform:none;letter-spacing:0">{t('menu.rulesNextHand')}</span></h4>
              <RulesForm rules={ui.rules} onchange={(r) => (ui.rules = r)} />
              <div class="tm-rules" style="margin-top:6px">
                <div class="tm-line">
                  <span>{t('menu.botsPlay')}</span>
                  <Switch label={t('menu.botsPlay')} on={ui.bots} ontoggle={(v) => (ui.bots = v)} />
                </div>
                <div class="tm-line"><span>{t('menu.pace')}</span><Seg value={ui.botDelay} options={[[350, t('pace.fast')], [800, t('pace.normal')], [1500, t('pace.slow')]]} onselect={(v) => (ui.botDelay = v)} /></div>
              </div>
            {/if}
          </div>
        </div>
        <div>
          <div class="tm-section">
            <h4>{t('menu.keyboard')}</h4>
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
        <button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>{t('nav.home')}</button>
        {#if snap.restart}<button class="ss-btn ghost" type="button" onclick={() => { newGame(); resume(); }}>{snap.restart === 'newGame' ? t('menu.newGame') : t('menu.rematch')}</button>{/if}
        <button class="ss-btn primary" type="button" onclick={resume}>{snap.seat === null ? t('menu.watch') : t('menu.play')} <Kbd keys={['↵']} /></button>
      </div>
    </div>
  </div>
{/if}
