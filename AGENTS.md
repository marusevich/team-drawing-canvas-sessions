# Instructions for AI deployment agents (Codex, etc.)

You are helping a non-engineer deploy this app to a public URL so their team can
use it during a one-time online event. Optimize for **simplicity and speed**, not
production hardening. Choose ONE platform and walk the user through it
step-by-step.

## Project facts

- **What it is:** A team drawing canvas. Single Node.js process; HTTP + WebSocket
  on the same port.
- **Entry point:** `server.js`
- **Start command:** `node server.js`  (or `npm start`)
- **Port:** Reads `process.env.PORT`, defaults to 3000. The app already binds to
  `0.0.0.0`.
- **Node version:** 18 or newer.
- **Dependencies:** None. `package.json` has no `dependencies` block.
- **Build step:** None.
- **Persistent storage:** None needed (in-memory game state by design).
- **Health check path:** `/` returns 200 OK with the HTML page.

## Hard requirements

1. The host **must support long-lived WebSocket connections** on the same port
   as HTTP. Browsers will open `wss://<host>/` and expect an HTTP/1.1 `101
   Switching Protocols` response.
2. **Do NOT propose Vercel, Netlify Functions, Cloudflare Workers, or any other
   FaaS/serverless platform.** They terminate connections after a few seconds
   and break the game.
3. The host must give the user a public HTTPS URL they can share.

## Recommended platforms (pick one)

In rough order of "easiest for a non-engineer":

1. **Render.com** — connect GitHub repo → "New Web Service" → auto-detects
   Node → done. Free tier sleeps after 15 min idle (acceptable for one event).
2. **Railway.app** — "Deploy from GitHub" → done. Requires a card on file even
   for the free trial credit.
3. **Fly.io** — `flyctl launch` from a local checkout. Uses the included
   `Dockerfile`. Never sleeps. CLI install required.

If none of those work for the user's situation, fall back to any container
host that runs the included `Dockerfile`.

## What the user has

- A GitHub account.
- The project on their local machine in a folder called `canvas/`.
- Probably no prior deployment experience. **Explain every step.** Don't assume
  they know what a git remote is, what a build command is, etc.

## What to do, in order

1. Help the user create a GitHub repository for this folder and push the code.
   Walk them through `git init`, the first commit, creating the repo on
   github.com (or via `gh` CLI if available), and pushing. Show actual commands.
2. Walk them through signing up / signing in to your chosen platform.
3. Walk them through connecting the GitHub repo and deploying.
4. After deployment, give them the public URL and remind them that this URL is
   what they share with their teammates.
5. Verify the WebSocket connection works by asking them to open the URL and
   confirm they can join with a name and the canvas screen appears (if they
   stay stuck on the name input screen, the WebSocket handshake is being
   blocked — investigate platform-specific WS configuration).

## What NOT to do

- Don't suggest editing the app code to "make it serverless-compatible". The
  WebSocket protocol is the whole point.
- Don't suggest a paid plan if a free tier exists.
- Don't add unnecessary dependencies, build tools, or frameworks. The whole app
  is intentionally dependency-free.
- Don't add SSL/TLS termination in the app — the platform handles HTTPS.

## Quick paste-prompt the user can give you

> "Please deploy the project in this folder to a public URL. It's a Node.js
> WebSocket app — single `server.js`, no dependencies, no build step. I have a
> GitHub account. Pick the easiest platform with a free tier (Render is fine),
> walk me through every step including creating the GitHub repo and pushing the
> code. Don't use Vercel or any serverless platform — they break WebSockets."
