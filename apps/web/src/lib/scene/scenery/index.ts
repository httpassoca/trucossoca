import type { SceneryId } from '@truco/protocol';
import { buildBar } from './bar';
import { buildGraveyard } from './graveyard';
import type { SceneryBuilder } from './scenery';

/** Os cenários que existem, pelo id do protocolo. */
export const SCENERY_BUILDERS: Record<SceneryId, SceneryBuilder> = { bar: buildBar, graveyard: buildGraveyard };
