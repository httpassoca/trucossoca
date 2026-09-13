# Truco Mineiro

3D first-person 2v2 Truco Mineiro for up to eight friends in rooms, plus offline play against bots. Desktop browser only. Bun workspaces monorepo:

- `packages/rules`: pure TypeScript engine and bots, `bun test`. No DOM, no three.js.
- `apps/web`: Vite + Svelte 5 + Threlte client. Talks to one table interface with a local adapter (engine in the browser) and a remote adapter (WebSocket).
- `apps/server` (planned): Bun WebSocket server running the engine as the authority, also serving the built client. One container on the VPS at truco.passoca.dev.

Domain vocabulary is in `CONTEXT.md` (Portuguese canonical terms, English code identifiers). Decisions are in `docs/adr/`. See `README.md` for the current code layout.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `httpassoca/trucossoca`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
