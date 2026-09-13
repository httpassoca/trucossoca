<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n.svelte';
  import { ui } from '../state.svelte';
  import { LocalTable } from '../table/local';
  import TableScreen from './Table.svelte';

  /**
   * A mesa offline: motor e bots no navegador, sem servidor, lendo a configuração de `ui` ao vivo.
   * As regras saem do proxy do `$state` como objeto plano: o motor guarda e clona o que recebe.
   */
  const table = new LocalTable({
    get rules() { return $state.snapshot(ui.rules); },
    get bots() { return ui.bots; },
    get botDelay() { return ui.botDelay; },
    get you() { return t('you'); },
    get teams(): [string, string] { return [t('team.us'), t('team.them')]; },
  });
  // ao sair da tela os bots param de jogar sozinhos
  onMount(() => { table.newGame(); return () => table.dispose(); });
</script>

<TableScreen {table} />
