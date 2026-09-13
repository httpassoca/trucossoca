<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { t } from '../i18n.svelte';
  import { rememberedScenery } from '../identity';
  import { route } from '../route.svelte';
  import { ui } from '../state.svelte';
  import { LocalTable } from '../table/local';
  import TableScreen from './Table.svelte';

  /**
   * A mesa offline: motor e bots no navegador, sem servidor, lendo a configuração de `ui` ao vivo.
   * As regras saem do proxy do `$state` como objeto plano: o motor guarda e clona o que recebe.
   * Em `/offline/assistir` a pessoa é fantasma e quatro bots jogam (a rota é lida uma vez: a tela nasce por ela).
   */
  const watch = untrack(() => route.current.name === 'offline' && route.current.watch);
  const table = new LocalTable({
    get rules() { return $state.snapshot(ui.rules); },
    get bots() { return ui.bots; },
    get botPace() { return ui.botPace; },
    get you() { return t('you'); },
    get teams(): [string, string] { return [t('team.us'), t('team.them')]; },
    scenery: rememberedScenery(),
    watch,
  });
  // ao sair da tela os bots param de jogar sozinhos
  onMount(() => { table.newGame(); return () => table.dispose(); });
</script>

<TableScreen {table} />
