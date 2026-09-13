# Rooms live in process memory, no accounts, nothing persists

The game is for up to eight friends. People join with a nickname and a random browser token, and a room dies after ten idle minutes. No database, no accounts, no history. A restart of the server, including every deploy, drops all running games. We accepted this because a deploy during a game is rare at this scale and persisting a mid-hand game state is real work for a problem that hasn't bitten. Revisit if it does.

## Amendment: the token is per tab

The first sala screen (#3) stores the token in `sessionStorage`, not `localStorage`: it survives a refresh and a network drop in the same tab, which is what reconnection needs, and two tabs of one browser are two people in the sala, which is how the sala is tested. The nickname stays per browser in `localStorage`. A closed tab is a person leaving; a duplicated tab copies the token, and the server hands the sala to the newest socket.
