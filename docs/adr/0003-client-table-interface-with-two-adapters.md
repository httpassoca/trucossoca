# The client talks to one table interface with a local and a remote adapter

Offline play against bots stays a feature, fully local with no server contact. Rather than two controller paths, the 3D scene and HUD talk to a single table interface. A local adapter runs the rules engine and bots in the browser; a remote adapter speaks the WebSocket protocol to the server. Screens never know which one is behind them.

## Consequences

A fake remote adapter can drive the UI in tests without a running server. Bots exist in two places (browser for offline, server for online) but share one implementation in the rules package.
