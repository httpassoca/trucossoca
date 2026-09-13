# Native Bun WebSocket instead of Socket.IO

passoca-api uses Socket.IO, so the obvious move was to reuse it here. We chose Bun's built-in WebSocket server and the browser's own WebSocket, with a small JSON message protocol, a heartbeat, and a reconnect loop written by us. Reconnection already has game semantics (a person reclaims their seat by returning with the same browser token, a bot plays meanwhile), so Socket.IO's reconnect would sit on top of ours anyway, and running it under Bun's Node compatibility layer adds a dependency for little.

## Consequences

Presence updates (ghost and player position and gaze, roughly ten a second) travel on a separate message channel from authoritative game events so they never interleave.
