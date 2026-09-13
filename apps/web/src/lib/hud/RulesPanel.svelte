<script lang="ts">
  import { SCENERIES, type SceneryId } from '@truco/protocol';
  import type { Rules } from '@truco/rules';
  import { t } from '../i18n.svelte';
  import RulesForm from './RulesForm.svelte';
  import Seg from './Seg.svelte';

  /** As regras e o cenário juntos, como o início e o lobby os mostram. `readonly` tranca as regras; `sceneryLocked`, o cenário. */
  let { rules, onchange = () => {}, readonly = false, scenery, onscenery = () => {}, sceneryLocked = false }: {
    rules: Rules; onchange?: (rules: Rules) => void; readonly?: boolean; scenery: SceneryId; onscenery?: (scenery: SceneryId) => void; sceneryLocked?: boolean;
  } = $props();
  const sceneryOptions = $derived(SCENERIES.map((s) => [s, t(`scenery.${s}`)] as [SceneryId, string]));
</script>

<RulesForm {rules} {onchange} {readonly} />
<div class="tm-rules" style="margin-top:6px">
  <div class="tm-line"><span>{t('scenery.label')}</span><Seg value={scenery} options={sceneryOptions} disabled={sceneryLocked} onselect={onscenery} /></div>
</div>
