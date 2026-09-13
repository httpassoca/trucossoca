# One container on the VPS serves both client and server

The game needs a long-lived WebSocket server, which static hosts and serverless platforms can't hold. We considered the client on Vercel with a separate API hostname, and mounting the server inside the existing passoca-api. We chose one Bun container in this monorepo that serves the built client as static files and handles WebSockets on the same origin, truco.passoca.dev, behind nginx on the same VPS as passoca-api. One deploy pipeline (a copy of passoca-api's scp-and-docker GitHub Actions workflow), no CORS, and no shared code across repositories.

## Considered options

- **Client on Vercel, server on the VPS**: two pipelines and a CORS boundary for no gain at friends scale.
- **Server as a module inside passoca-api**: one Socket.IO instance already exists, but the engine would need to be shared across repos (npm package or git submodule), passoca-api is on TypeScript 4.5 and CommonJS, and every unrelated API deploy would kill running games.
