<script lang="ts">
  import { NICKNAME_MAX, TEAM_NAME_MAX, type RoomMemberView } from '@truco/protocol';
  import { teamOf, type Team } from '@truco/rules';
  import { onMount, untrack } from 'svelte';
  import RulesForm from '../hud/RulesForm.svelte';
  import Switch from '../hud/Switch.svelte';
  import { rememberNickname, rememberedNickname, token } from '../identity';
  import { openRoom, wsUrl } from '../rooms';
  import { navigate, roomPath } from '../route.svelte';
  import { RemoteTable, type ClosedReason, type RemoteState } from '../table/remote';
  import TableScreen from './Table.svelte';

  let { code }: { code: string } = $props();

  let remote = $state.raw<RemoteState>({ status: 'idle', room: null, reason: null, attempt: 0 });
  let nickname = $state(rememberedNickname());
  let copied = $state(false);
  let field = $state<HTMLInputElement>();
  // a rota recria esta tela a cada código novo (App faz {#key}); o código inicial basta
  const table = new RemoteTable({ url: wsUrl(), room: untrack(() => code), token: token() });

  onMount(() => {
    const off = table.watch((s) => (remote = s));
    const online = () => table.retryNow();
    window.addEventListener('online', online);
    table.connect();
    field?.focus();
    return () => { window.removeEventListener('online', online); off(); table.dispose(); };
  });

  const room = $derived(remote.room);
  const me = $derived(room?.members.find((m) => m.id === room?.you) ?? null);
  const link = $derived(location.origin + roomPath(code));
  const live = $derived(remote.status === 'open');
  const STATUS: Record<RemoteState['status'], string> = { idle: '', connecting: 'conectando…', open: 'ao vivo', reconnecting: 'sem conexão, tentando de novo…', closed: '' };
  const GONE: Record<NonNullable<ClosedReason>, [string, string]> = {
    'room-not-found': ['Essa sala não existe', 'O código pode estar errado, ou a sala já acabou.'],
    'room-ended': ['Essa sala acabou', 'Ficou dez minutos sem ninguém fazer nada e fechou.'],
    replaced: ['Outra aba assumiu', 'Esta sala continua aberta em outra aba deste navegador.'],
  };

  // quem não senta é fantasma
  const teamOfMember = (m: RoomMemberView): Team | null => (m.seat === null ? null : teamOf(m.seat));
  const seatedIn = (team: Team) => (room?.members ?? []).filter((m) => teamOfMember(m) === team).sort((a, b) => a.seat! - b.seat!);
  const ghosts = $derived((room?.members ?? []).filter((m) => m.seat === null));
  const myTeam = $derived(me ? teamOfMember(me) : null);
  const canStart = $derived(live && !!me && me.seat !== null);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const n = nickname.trim(); if (!n) return;
    rememberNickname(n);
    if (me) table.setNickname(n); else table.join(n);
  }
  function rename(team: Team, e: Event) {
    const name = (e.currentTarget as HTMLInputElement).value;
    if (room && name.trim() !== room.teams[team]) table.renameTeam(team, name);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); copied = true; setTimeout(() => (copied = false), 1500); } catch { /* sem clipboard: o link está na barra do navegador */ }
  }
</script>

{#snippet member(m: RoomMemberView)}
  <li class:off={!m.connected}>
    <span>{m.nickname}</span>
    {#if m.id === room?.you}<span class="ss-badge brand">você</span>{/if}
    {#if m.bot}<span class="ss-badge neutral">bot</span>{/if}
    {#if !m.connected}<span class="ss-badge neutral">caiu</span>{/if}
  </li>
{/snippet}

{#if remote.status === 'closed' && remote.reason}
  <div class="tm-screen">
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
  </div>
{:else if me && room?.phase === 'playing'}
  <!-- a partida começou: todo mundo cai na mesa 3D; quem não tem cadeira olha como fantasma -->
  <TableScreen {table} menuOpen={false} />
  {#if remote.status !== 'open'}<div class="tm-toast tm-warn">{STATUS[remote.status]}</div>{/if}
{:else if !me}
  <div class="tm-screen">
    <div class="ss-card elevated tm-panel">
      <div class="head">
        <div class="heading"><span class="title">sala {code}</span><span class="desc">{room?.phase === 'playing' ? 'a partida já começou — entre para assistir' : 'mande o código ou o link para os amigos'}</span></div>
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
          <button class="ss-btn primary" type="submit" disabled={!live || !nickname.trim()}>Entrar</button>
        </form>
        <div class="tm-section">
          <h4>Na sala</h4>
          {#if !room || room.members.length === 0}
            <p class="tm-hint">Ninguém entrou ainda.</p>
          {:else}
            <ul class="tm-members">
              {#each room.members as m (m.id)}{@render member(m)}{/each}
            </ul>
          {/if}
        </div>
      </div>
      <div class="foot"><button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>Início</button></div>
    </div>
  </div>
{:else if room}
  <div class="tm-screen">
    <div class="ss-card elevated tm-panel tm-lobby">
      <div class="head">
        <div class="heading"><span class="title">sala {code}</span><span class="desc">escolham as duplas; quem está sentado começa</span></div>
        <span class="meta" class:tm-warn={remote.status === 'reconnecting'}>{STATUS[remote.status]}</span>
      </div>
      <div class="body">
        <div class="tm-share">
          <span class="tm-code">{code}</span>
          <button class="ss-btn" type="button" onclick={copy}>{copied ? 'Link copiado' : 'Copiar link'}</button>
        </div>

        <div class="tm-teams">
          {#each [0, 1] as const as team (team)}
            {@const members = seatedIn(team)}
            <div class="ss-card tm-team" class:mine={myTeam === team}>
              <div class="head">
                <input class="ss-input tm-team-name" value={room.teams[team]} maxlength={TEAM_NAME_MAX} aria-label="nome da dupla" spellcheck="false" onchange={(e) => rename(team, e)} />
              </div>
              <div class="body">
                <ul class="tm-members">
                  {#each members as m (m.id)}{@render member(m)}{/each}
                  {#each { length: 2 - members.length } as _, i (i)}<li class="empty"><span>cadeira livre (bot se ninguém sentar)</span></li>{/each}
                </ul>
              </div>
              <div class="foot">
                <button class="ss-btn" type="button" disabled={!live || myTeam === team || members.length >= 2} onclick={() => table.takeSeat(team)}>{myTeam === team ? 'Você está aqui' : 'Sentar aqui'}</button>
              </div>
            </div>
          {/each}
        </div>

        <div class="tm-section">
          <h4>Sem cadeira <span style="text-transform:none;letter-spacing:0">(assistem como fantasmas)</span></h4>
          {#if ghosts.length === 0}
            <p class="tm-hint">Ninguém.</p>
          {:else}
            <ul class="tm-members">
              {#each ghosts as m (m.id)}{@render member(m)}{/each}
            </ul>
          {/if}
          {#if me.seat !== null}<button class="ss-btn ghost" type="button" disabled={!live} onclick={() => table.leaveSeat()}>Levantar da cadeira</button>{/if}
        </div>

        <div class="tm-section">
          <h4>Regras <span style="text-transform:none;letter-spacing:0">(qualquer pessoa ajusta; trancam quando a partida começa)</span></h4>
          <RulesForm rules={room.rules} onchange={(r) => table.setRules(r)} readonly={!live} />
          <div class="tm-rules" style="margin-top:6px">
            <div class="tm-line">
              <span>Fantasmas veem as cartas de todo mundo</span>
              <Switch label="Fantasmas veem as cartas" on={room.ghostsSeeCards} disabled={!live} ontoggle={(v) => table.setGhostsSeeCards(v)} />
            </div>
          </div>
        </div>

        <form class="tm-form" onsubmit={submit}>
          <label class="ss-field">
            <span class="lbl">Seu apelido</span>
            <span class="control"><input class="ss-input" bind:value={nickname} maxlength={NICKNAME_MAX} spellcheck="false" /></span>
          </label>
          <button class="ss-btn" type="submit" disabled={!live || !nickname.trim() || nickname.trim() === me.nickname}>Trocar</button>
        </form>
      </div>
      <div class="foot">
        <button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>Início</button>
        <button class="ss-btn primary" type="button" disabled={!canStart} title={me.seat === null ? 'Sente numa dupla para começar' : ''} onclick={() => table.start()}>Começar a partida</button>
      </div>
    </div>
  </div>
{/if}
