<script lang="ts">
  import { promptAct, promptOf } from '../controller';
  import { callName } from '../format';
  import { t } from '../i18n.svelte';
  import { live } from '../state.svelte';
  import Kbd from './Kbd.svelte';

  const snap = $derived(live.snap);
  const game = $derived(snap.game);
  const p = $derived(promptOf(snap));
  const q = $derived(game.hand?.pending ?? null);
  const more = $derived(q && q.toIdx + 1 < game.rules.ladder.length ? callName(game.rules.ladder[q.toIdx + 1]).replace('!', '') : null);
</script>

{#if p}
  <div class="ss-card elevated tm-prompt">
    <div class="body">
      {#if p.kind === 'respond' && q}
        <h3 class="tm-title">{snap.seats[q.by].name}: {callName(q.to)}</h3>
        <p class="tm-text">{t('prompt.respondText', { to: q.to, from: q.from })}</p>
        <div class="tm-row">
          <button class="ss-btn primary" type="button" onclick={() => promptAct('accept')}>{t('prompt.accept')} <Kbd keys={['↵']} /></button>
          <button class="ss-btn" type="button" onclick={() => promptAct('decline')}>{t('prompt.decline')} <Kbd keys={['X']} /></button>
          {#if more}<button class="ss-btn danger" type="button" onclick={() => promptAct('raise')}>{t('prompt.raise', { call: more })} <Kbd keys={['R']} /></button>{/if}
        </div>
      {:else if p.kind === 'dez'}
        <h3 class="tm-title">{t('prompt.dezTitle')}</h3>
        <p class="tm-text">{game.rules.maoDeDezPeek ? t('prompt.dezPeek') : ''}{t('prompt.dezText', { value: game.hand!.value })}</p>
        <div class="tm-row">
          <button class="ss-btn primary" type="button" onclick={() => promptAct('play')}>{t('prompt.play')} <Kbd keys={['↵']} /></button>
          <button class="ss-btn" type="button" onclick={() => promptAct('run')}>{t('prompt.decline')} <Kbd keys={['X']} /></button>
        </div>
      {:else if p.kind === 'over'}
        <h3 class="tm-title">{t('prompt.over', { team: snap.teams[game.winner!] })}</h3>
        <p class="tm-text">{game.scores[0]} × {game.scores[1]}</p>
        {#if snap.restart}<div class="tm-row"><button class="ss-btn primary" type="button" onclick={() => promptAct('new')}>{snap.restart === 'newGame' ? t('menu.newGame') : t('prompt.rematch')} <Kbd keys={['↵']} /></button></div>{/if}
      {/if}
    </div>
  </div>
{/if}
