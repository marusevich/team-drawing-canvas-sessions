# 🚀 Team Drawing Canvas

A multiplayer, turn-based drawing canvas for team events. Players take turns drawing
one stroke each on a shared canvas. Updates sync in real time over WebSocket.

Built for a company anniversary: a team of 3–5 people opens a shared link, takes turns
adding one stroke each, and together draws a rocket.

## Stack

- **Backend:** Node.js (built-in modules only, zero npm dependencies)
- **Frontend:** Single `index.html` file — plain HTML/CSS/JS, no build step
- **Transport:** WebSocket (RFC 6455 implemented inline in `server.js`)

## Project structure

```
canvas/
├── server.js        # HTTP + WebSocket server, all game logic
├── index.html       # Self-contained client (UI + canvas + WS client)
├── package.json     # Metadata, engines, start/test scripts (no deps)
├── test.js          # Smoke test (2 players, queue, undo, clear)
├── Dockerfile       # Container image for deployment
├── .gitignore
├── AGENTS.md        # Deployment instructions for AI agents (Codex etc.)
└── README.md
```

## Run locally

Requires Node.js 18+.

```bash
node server.js
# → http://localhost:3000
```

The server prints both the local URL and your LAN IP so teammates on the same
Wi-Fi can join via `http://<lan-ip>:3000`.

For testing across the public internet without deploying, use any TCP tunnel:

```bash
# Option A — ssh tunnel via localhost.run (no install)
ssh -R 80:localhost:3000 nokey@localhost.run

# Option B — ngrok (requires free account)
ngrok http 3000
```

Avoid `npx localtunnel` — it interferes with the WebSocket upgrade handshake.

## Run tests

```bash
# Terminal 1
node server.js

# Terminal 2
node test.js
# → "8 passed, 0 failed"
```

## Deployment

This app needs a host that supports **persistent WebSocket connections**.
**Vercel / Netlify serverless functions will NOT work** — use a long-running container/dyno.

Recommended platforms (all have free tiers):

| Platform     | Free tier         | WS support | Notes                                 |
| ------------ | ----------------- | ---------- | ------------------------------------- |
| Render       | 750 hr/month      | ✅          | Sleeps after 15 min idle              |
| Railway      | $5/month credit   | ✅          | Requires card on file                 |
| Fly.io       | Free tier         | ✅          | Never sleeps, requires `flyctl`       |

See `AGENTS.md` for a ready-to-paste prompt that you can give to OpenAI Codex
or any other AI coding agent to handle the deployment for you.

## Game rules

1. Each player enters a name and joins the shared canvas.
2. Players draw in join order — one stroke per turn.
3. One stroke = one mouse-down → mouse-up.
4. After drawing, the player clicks **"Done — pass it on"** to release the turn.
5. Anyone can hit **Undo** or **Clear all**.
6. **Save image** exports the current canvas as PNG.

## Notes & limitations

- In-memory state — canvas is wiped on server restart.
- No persistence, no rooms, no auth — single shared canvas, single shared queue.
- Designed for a one-shot event with ≤10 concurrent players. Not load-tested beyond that.
- Port is configurable via `PORT` environment variable (default 3000).

## License

MIT
