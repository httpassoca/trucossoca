import type { SceneryId } from '@truco/protocol';
import type { Rules } from '@truco/rules';
import { navigate, roomPath } from './route.svelte';

/** Pede uma sala nova ao servidor, já com as regras e o cenário que a pessoa escolheu no início, e vai para ela. */
export async function openRoom(setup?: { rules: Rules; scenery: SceneryId }) {
  const r = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(setup ?? {}) });
  if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
  const { code } = (await r.json()) as { code: string };
  navigate(roomPath(code));
}

/** Endereço do WebSocket na mesma origem (em dev o Vite faz proxy para o servidor). */
export const wsUrl = () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
