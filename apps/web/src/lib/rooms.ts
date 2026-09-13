import { navigate, roomPath } from './route.svelte';

/** Pede uma sala nova ao servidor e vai para ela. */
export async function openRoom() {
  const r = await fetch('/api/rooms', { method: 'POST' });
  if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
  const { code } = (await r.json()) as { code: string };
  navigate(roomPath(code));
}

/** Endereço do WebSocket na mesma origem (em dev o Vite faz proxy para o servidor). */
export const wsUrl = () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
