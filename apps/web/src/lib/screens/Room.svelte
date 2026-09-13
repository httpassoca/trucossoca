<script lang="ts">
  import { IDLE_HANDOFF, NICKNAME_MAX, TEAM_NAME_MAX, type RoomMemberView } from '@truco/protocol';
  import { teamOf, type Team } from '@truco/rules';
  import { onMount, untrack } from 'svelte';
  import LangSwitch from '../hud/LangSwitch.svelte';
  import RulesForm from '../hud/RulesForm.svelte';
  import Switch from '../hud/Switch.svelte';
  import type { MsgKey } from '../i18n';
  import { t } from '../i18n.svelte';
  import { rememberNickname, rememberedNickname, token } from '../identity';
  import { openRoom, wsUrl } from '../rooms';
  import { navigate, roomPath } from '../route.svelte';
  import { RemoteTable, type ClosedReason, type RemoteState } from '../table/remote';
  import TableScreen from './Table.svelte';

  let { code }: { code: string } = $props();

  let remote = $state.raw<RemoteState>({ status: 'idle', room: null, reason: null, attempt: 0, wantsSeat: null });
  /** quando o snapshot atual chegou e a hora de agora: `idle` de cada pessoa é medido no snapshot e envelhece daqui */
  let snapAt = $state(Date.now());
  let now = $state(Date.now());
  let nickname = $state(rememberedNickname());
  let copied = $state(false);
  let field = $state<HTMLInputElement>();
  // a rota recria esta tela a cada código novo (App faz {#key}); o código inicial basta
  const table = new RemoteTable({ url: wsUrl(), room: untrack(() => code), token: token() });

  onMount(() => {
    const off = table.watch((s) => { if (s.room !== remote.room) snapAt = Date.now(); remote = s; });
    // a rede caiu e voltou: sem esperar o ping descobrir
    const online = () => table.retryNow();
    const offline = () => table.reconnect();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    table.connect();
    field?.focus();
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); off(); table.dispose(); };
  });
  // durante a partida o relógio anda, para o botão de passar uma cadeira liberar na hora certa
  $effect(() => {
    if (remote.room?.phase !== 'playing') return;
    const h = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(h);
  });

  const room = $derived(remote.room);
  const me = $derived(room?.members.find((m) => m.id === room?.you) ?? null);
  const link = $derived(location.origin + roomPath(code));
  const live = $derived(remote.status === 'open');
  const STATUS: Record<RemoteState['status'], MsgKey | null> = { idle: null, connecting: 'status.connecting', open: 'status.open', reconnecting: 'status.reconnecting', closed: null };
  const status = $derived.by(() => { const k = STATUS[remote.status]; return k ? t(k) : ''; });
  const GONE = { 'room-not-found': 'notFound', 'room-ended': 'ended', replaced: 'replaced' } as const satisfies Record<NonNullable<ClosedReason>, string>;

  // quem não senta é fantasma
  const teamOfMember = (m: RoomMemberView): Team | null => (m.seat === null ? null : teamOf(m.seat));
  const seatedIn = (team: Team) => (room?.members ?? []).filter((m) => teamOfMember(m) === team).sort((a, b) => a.seat! - b.seat!);
  const ghosts = $derived((room?.members ?? []).filter((m) => m.seat === null));
  const myTeam = $derived(me ? teamOfMember(me) : null);
  const canStart = $derived(live && !!me && me.seat !== null);
  const seated = $derived((room?.members ?? []).filter((m) => m.seat !== null).sort((a, b) => a.seat! - b.seat!));
  /** há quanto tempo esta pessoa não age, agora */
  const idleFor = (m: RoomMemberView) => m.idle + Math.max(0, now - snapAt);
  /** outra pessoa sentada, que ainda joga por si: quem senta pode passar a cadeira dela a um bot depois de um minuto parada */
  const canHandOff = (m: RoomMemberView) => live && !!me && me.seat !== null && m.id !== me.id && !m.bot && m.connected && !m.botControlled;
  const handOffWait = (m: RoomMemberView) => Math.max(0, Math.ceil((IDLE_HANDOFF - idleFor(m)) / 1000));
  /** fantasma pode sentar no lugar de um bot: vai entre uma mão e outra (a intenção espera a mão acabar) */
  const canTakeBot = (m: RoomMemberView) => live && !!me && me.seat === null && m.bot && m.seat !== null;

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

{#snippet badges(m: RoomMemberView)}
  {#if m.id === room?.you}<span class="ss-badge brand">{t('badge.you')}</span>{/if}
  {#if m.bot}<span class="ss-badge neutral">{t('badge.bot')}</span>{/if}
  {#if !m.connected}<span class="ss-badge neutral">{t('badge.dropped')}</span>{/if}
  {#if m.botControlled}<span class="ss-badge caution" title={t('badge.botPlaying.title')}>{t('badge.botPlaying')}</span>{/if}
{/snippet}
<!-- `handoff`: com os botões da mesa: passar a cadeira a um bot (quem senta) e sentar no lugar de um bot (fantasma) -->
{#snippet member(m: RoomMemberView, handoff = false)}
  <li class:off={!m.connected}>
    <span>{m.nickname}</span>
    {@render badges(m)}
    {#if handoff && canHandOff(m)}
      {@const wait = handOffWait(m)}
      <button class="ss-btn" type="button" disabled={wait > 0} title={wait > 0 ? t('handoff.wait.title', { wait }) : t('handoff.title')} onclick={() => table.handToBot(m.id)}>
        {wait > 0 ? t('handoff.wait', { wait }) : t('handoff')}
      </button>
    {:else if handoff && canTakeBot(m)}
      {#if remote.wantsSeat === m.seat}
        <button class="ss-btn" type="button" title={t('takeBot.pending.title')} onclick={() => table.takeBotSeat(null)}>{t('takeBot.pending')}</button>
      {:else}
        <button class="ss-btn" type="button" title={t('takeBot.title')} onclick={() => table.takeBotSeat(m.seat!)}>{t('takeBot')}</button>
      {/if}
    {/if}
  </li>
{/snippet}
<!-- no menu da mesa: quem senta, quem caiu, e passar a cadeira de quem ficou parada a um bot -->
{#snippet roomPanel()}
  <h4>{t('room.panelTitle', { code })} <span style="text-transform:none;letter-spacing:0">({status})</span></h4>
  <ul class="tm-members">
    {#each seated as m (m.id)}{@render member(m, true)}{/each}
  </ul>
  {#if ghosts.length}<p class="tm-hint">{t('room.ghosts', { names: ghosts.map((m) => m.nickname).join(', ') })}</p>{/if}
{/snippet}

{#if remote.status === 'closed' && remote.reason}
  <div class="tm-screen">
    <div class="ss-card elevated tm-panel">
      <div class="body">
        <div class="ss-empty error">
          <div class="title">{t(`gone.${GONE[remote.reason]}.title`)}</div>
          <p class="msg">{t(`gone.${GONE[remote.reason]}.msg`)}</p>
          <div class="act">
            <button class="ss-btn primary" type="button" onclick={openRoom}>{t('room.openNew')}</button>
            <button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>{t('nav.home')}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
{:else if me && room?.phase === 'playing'}
  <!-- a partida começou: todo mundo cai na mesa 3D; quem não tem cadeira olha como fantasma -->
  <TableScreen {table} menuOpen={false} room={roomPanel} />
  {#if remote.status !== 'open'}<div class="tm-toast tm-warn">{status}</div>{/if}
{:else if !me}
  <div class="tm-screen">
    <div class="ss-card elevated tm-panel">
      <div class="head">
        <div class="heading"><span class="title">{t('room.title', { code })}</span><span class="desc">{room?.phase === 'playing' ? t('room.joinToWatch') : t('room.share')}</span></div>
        <span class="meta" class:tm-warn={remote.status === 'reconnecting'}>{status}</span>
      </div>
      <div class="body">
        <div class="tm-share">
          <span class="tm-code">{code}</span>
          <button class="ss-btn" type="button" onclick={copy}>{copied ? t('room.copied') : t('room.copy')}</button>
        </div>
        <form class="tm-form" onsubmit={submit}>
          <label class="ss-field">
            <span class="lbl">{t('room.nickname')}</span>
            <span class="control"><input class="ss-input" bind:this={field} bind:value={nickname} maxlength={NICKNAME_MAX} placeholder={t('room.nicknamePlaceholder')} spellcheck="false" /></span>
          </label>
          <button class="ss-btn primary" type="submit" disabled={!live || !nickname.trim()}>{t('home.enter')}</button>
        </form>
        <div class="tm-section">
          <h4>{t('room.inRoom')}</h4>
          {#if !room || room.members.length === 0}
            <p class="tm-hint">{t('room.nobodyYet')}</p>
          {:else}
            <ul class="tm-members">
              {#each room.members as m (m.id)}{@render member(m)}{/each}
            </ul>
          {/if}
        </div>
      </div>
      <div class="foot"><button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>{t('nav.home')}</button><LangSwitch /></div>
    </div>
  </div>
{:else if room}
  <div class="tm-screen">
    <div class="ss-card elevated tm-panel tm-lobby">
      <div class="head">
        <div class="heading"><span class="title">{t('room.title', { code })}</span><span class="desc">{t('room.pickTeams')}</span></div>
        <span class="meta" class:tm-warn={remote.status === 'reconnecting'}>{status}</span>
      </div>
      <div class="body">
        <div class="tm-share">
          <span class="tm-code">{code}</span>
          <button class="ss-btn" type="button" onclick={copy}>{copied ? t('room.copied') : t('room.copy')}</button>
        </div>

        <div class="tm-teams">
          {#each [0, 1] as const as team (team)}
            {@const members = seatedIn(team)}
            <div class="ss-card tm-team" class:mine={myTeam === team}>
              <div class="head">
                <input class="ss-input tm-team-name" value={room.teams[team]} maxlength={TEAM_NAME_MAX} aria-label={t('room.teamName')} spellcheck="false" onchange={(e) => rename(team, e)} />
              </div>
              <div class="body">
                <ul class="tm-members">
                  {#each members as m (m.id)}{@render member(m)}{/each}
                  {#each { length: 2 - members.length } as _, i (i)}<li class="empty"><span>{t('room.freeSeat')}</span></li>{/each}
                </ul>
              </div>
              <div class="foot">
                <button class="ss-btn" type="button" disabled={!live || myTeam === team || members.length >= 2} onclick={() => table.takeSeat(team)}>{myTeam === team ? t('room.youAreHere') : t('room.sitHere')}</button>
              </div>
            </div>
          {/each}
        </div>

        <div class="tm-section">
          <h4>{t('room.noSeat')} <span style="text-transform:none;letter-spacing:0">{t('room.noSeat.sub')}</span></h4>
          {#if ghosts.length === 0}
            <p class="tm-hint">{t('room.nobody')}</p>
          {:else}
            <ul class="tm-members">
              {#each ghosts as m (m.id)}{@render member(m)}{/each}
            </ul>
          {/if}
          {#if me.seat !== null}<button class="ss-btn ghost" type="button" disabled={!live} onclick={() => table.leaveSeat()}>{t('room.standUp')}</button>{/if}
        </div>

        <div class="tm-section">
          <h4>{t('room.rules')} <span style="text-transform:none;letter-spacing:0">{t('room.rules.sub')}</span></h4>
          <RulesForm rules={room.rules} onchange={(r) => table.setRules(r)} readonly={!live} />
          <div class="tm-rules" style="margin-top:6px">
            <div class="tm-line">
              <span>{t('room.ghostsSee')}</span>
              <Switch label={t('room.ghostsSee')} on={room.ghostsSeeCards} disabled={!live} ontoggle={(v) => table.setGhostsSeeCards(v)} />
            </div>
          </div>
        </div>

        <form class="tm-form" onsubmit={submit}>
          <label class="ss-field">
            <span class="lbl">{t('room.yourNickname')}</span>
            <span class="control"><input class="ss-input" bind:value={nickname} maxlength={NICKNAME_MAX} spellcheck="false" /></span>
          </label>
          <button class="ss-btn" type="submit" disabled={!live || !nickname.trim() || nickname.trim() === me.nickname}>{t('room.rename')}</button>
        </form>
      </div>
      <div class="foot">
        <button class="ss-btn ghost" type="button" onclick={() => navigate('/')}>{t('nav.home')}</button>
        <LangSwitch />
        <button class="ss-btn primary" type="button" disabled={!canStart} title={me.seat === null ? t('room.sitToStart') : ''} onclick={() => table.start()}>{t('room.start')}</button>
      </div>
    </div>
  </div>
{/if}
