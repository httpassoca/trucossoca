<script lang="ts">
  import { NICKNAME_MAX } from '@truco/protocol';
  import { onMount } from 'svelte';
  import { rememberNickname, rememberedNickname, token } from '../identity';
  import { openRoom, wsUrl } from '../rooms';
  import { navigate, roomPath } from '../route.svelte';
  import { RemoteTable, type ClosedReason, type RemoteState } from '../table/remote';

  let { code }: { code: string } = $props();

  let remote = $state.raw<RemoteState>({ status: 'idle', room: null, reason: null, attempt: 0 });
  let nickname = $state(rememberedNickname());
  let copied = $state(false);
  let field = $state<HTMLInputElement>();
  let table: RemoteTable;

  onMount(() => {
    table = new RemoteTable({ url: wsUrl(), room: code, token: token() });
    const off = table.subscribe((s) => (remote = s));
    const online = () => table.retryNow();
    window.addEventListener('online', online);
    table.connect();
    field?.focus();
    return () => { window.removeEventListener('online', online); off(); table.dispose(); };
  });

  const me = $derived(remote.room?.members.find((m) => m.id === remote.room?.you) ?? null);
  const link = $derived(location.origin + roomPath(code));
  const STATUS: Record<RemoteState['status'], string> = { idle: '', connecting: 'conectando…', open: 'ao vivo', reconnecting: 'sem conexão, tentando de novo…', closed: '' };
  const GONE: Record<NonNullable<ClosedReason>, [string, string]> = {
    'room-not-found': ['Essa sala não existe', 'O código pode estar errado, ou a sala já acabou.'],
    'room-ended': ['Essa sala acabou', 'Ficou dez minutos sem ninguém fazer nada e fechou.'],
    replaced: ['Outra aba assumiu', 'Esta sala continua aberta em outra aba deste navegador.'],
  };

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const n = nickname.trim(); if (!n) return;
    rememberNickname(n);
    if (me) table.setNickname(n); else table.join(n);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); copied = true; setTimeout(() => (copied = false), 1500); } catch { /* sem clipboard: o link está na barra do navegador */ }
  }
</script>

<div class="tm-screen">
  {#if remote.status === 'closed' && remote.reason}
    <div class="ss-card elevated tm-panel">
      <div class="body">
        <div class="ss-empty error">
          <div class="title">{GONE[remote.reason][0]}</div>
          <p class="msg">{GONE[remote.reason][1]}</p>
          <div class="act">
            <button class="ss-btn primary" type="button" onclick={openRoom}>Abrir uma sala nova</button>
            <button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>Início</button>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="ss-card elevated tm-panel">
      <div class="head">
        <div class="heading"><span class="title">sala {code}</span><span class="desc">mande o código ou o link para os amigos</span></div>
        <span class="meta" class:tm-warn={remote.status === 'reconnecting'}>{STATUS[remote.status]}</span>
      </div>
      <div class="body">
        <div class="tm-share">
          <span class="tm-code">{code}</span>
          <button class="ss-btn" type="button" onclick={copy}>{copied ? 'Link copiado' : 'Copiar link'}</button>
        </div>
        <form class="tm-form" onsubmit={submit}>
          <label class="ss-field">
            <span class="lbl">Apelido</span>
            <span class="control"><input class="ss-input" bind:this={field} bind:value={nickname} maxlength={NICKNAME_MAX} placeholder="como te chamam na mesa" spellcheck="false" /></span>
          </label>
          <button class="ss-btn primary" type="submit" disabled={remote.status !== 'open' || !nickname.trim()}>{me ? 'Trocar' : 'Entrar'}</button>
        </form>
        <div class="tm-section">
          <h4>Na sala</h4>
          {#if !remote.room || remote.room.members.length === 0}
            <p class="tm-hint">Ninguém entrou ainda.</p>
          {:else}
            <ul class="tm-members">
              {#each remote.room.members as m (m.id)}
                <li class:off={!m.connected}>
                  <span>{m.nickname}</span>
                  {#if m.id === remote.room.you}<span class="ss-badge brand">você</span>{/if}
                  {#if !m.connected}<span class="ss-badge neutral">caiu</span>{/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
      <div class="foot"><button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>Início</button></div>
    </div>
  {/if}
</div>
