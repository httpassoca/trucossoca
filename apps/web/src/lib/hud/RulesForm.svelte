<script lang="ts">
  import type { Rules } from '@truco/rules';
  import Seg from './Seg.svelte';
  import Switch from './Switch.svelte';

  /** As regras individuais do Mineiro. `readonly`: só mostra (regras trancadas durante a partida). */
  let { rules, onchange = () => {}, readonly = false }: { rules: Rules; onchange?: (rules: Rules) => void; readonly?: boolean } = $props();

  type BoolRule = { [K in keyof Rules]: Rules[K] extends boolean ? K : never }[keyof Rules];
  const switches: { key: BoolRule; label: string }[] = [
    { key: 'raiseOnlyOnTurn', label: 'Trucar só na sua vez' },
    { key: 'alternateRaises', label: 'Aumentos alternam entre duplas' },
    { key: 'allowCovered', label: 'Carta coberta permitida' },
    { key: 'maoDeDezPeek', label: 'Mão de dez: olhar carta do parceiro' },
    { key: 'maoDeFerroBlind', label: 'Mão de ferro às cegas' },
    { key: 'allTieNobody', label: 'Empate nas 3 vazas: ninguém pontua' },
  ];
  const set = (patch: Partial<Rules>) => { if (!readonly) onchange({ ...rules, ...patch }); };
</script>

<div class="tm-rules">
  {#each switches as s (s.key)}
    <div class="tm-line">
      <span>{s.label}</span>
      <Switch label={s.label} on={rules[s.key]} disabled={readonly} ontoggle={(v) => set({ [s.key]: v })} />
    </div>
  {/each}
  <div class="tm-line"><span>Cobrir a partir da vaza</span><Seg value={rules.coverFromTrick} options={[[1, '1ª'], [2, '2ª']]} disabled={readonly} onselect={(v) => set({ coverFromTrick: v })} /></div>
  <div class="tm-line"><span>Após empate, quem sai</span><Seg value={rules.tieLeader} options={[['mao', 'o mão'], ['leader', 'quem saiu']]} disabled={readonly} onselect={(v) => set({ tieLeader: v })} /></div>
</div>
<div class="tm-hint">Manilhas fixas: 4♣ &gt; 7♥ &gt; A♠ &gt; 7♦ · escada {rules.ladder.join(' → ')} · partida até {rules.target}</div>
