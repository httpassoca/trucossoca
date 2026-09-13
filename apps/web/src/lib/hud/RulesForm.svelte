<script lang="ts">
  import type { Rules } from '@truco/rules';
  import { t } from '../i18n.svelte';
  import Seg from './Seg.svelte';
  import Switch from './Switch.svelte';

  /** As regras individuais do Mineiro. `readonly`: só mostra (regras trancadas durante a partida). */
  let { rules, onchange = () => {}, readonly = false }: { rules: Rules; onchange?: (rules: Rules) => void; readonly?: boolean } = $props();

  // as regras de interruptor que a mesa expõe (as manilhas fixas e a vira ficam como estão no Mineiro)
  const switches = ['raiseOnlyOnTurn', 'alternateRaises', 'allowCovered', 'maoDeDezPeek', 'maoDeFerroBlind', 'allTieNobody'] as const;
  const set = (patch: Partial<Rules>) => { if (!readonly) onchange({ ...rules, ...patch }); };
</script>

<div class="tm-rules">
  {#each switches as key (key)}
    {@const label = t(`rules.${key}`)}
    <div class="tm-line">
      <span>{label}</span>
      <Switch {label} on={rules[key]} disabled={readonly} ontoggle={(v) => set({ [key]: v })} />
    </div>
  {/each}
  <div class="tm-line"><span>{t('rules.coverFrom')}</span><Seg value={rules.coverFromTrick} options={[[1, t('rules.trick1')], [2, t('rules.trick2')]]} disabled={readonly} onselect={(v) => set({ coverFromTrick: v })} /></div>
  <div class="tm-line"><span>{t('rules.tieLeader')}</span><Seg value={rules.tieLeader} options={[['mao', t('rules.tieMao')], ['leader', t('rules.tieLed')]]} disabled={readonly} onselect={(v) => set({ tieLeader: v })} /></div>
</div>
<div class="tm-hint">{t('rules.summary', { ladder: rules.ladder.join(' → '), target: rules.target })}</div>
