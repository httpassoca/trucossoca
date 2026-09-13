# Rooms live in process memory, no accounts, nothing persists

The game is for up to eight friends. People join with a nickname and a random browser token, and a room dies after ten idle minutes. No database, no accounts, no history. A restart of the server, including every deploy, drops all running games. We accepted this because a deploy during a game is rare at this scale and persisting a mid-hand game state is real work for a problem that hasn't bitten. Revisit if it does.
