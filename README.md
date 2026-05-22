# Team Drawing Canvas Sessions

A multiplayer, turn-based drawing canvas for team events. Players take turns
drawing one stroke each on a shared canvas. The goal is to draw a cat together.
Each team can create its own session link, so multiple teams can play at the
same time without sharing the same canvas.

## Stack

- Frontend: plain HTML, CSS, and JavaScript
- Realtime sync: Liveblocks Storage and Presence
- Hosting: GitHub Pages
- Local preview: optional Node.js static file server

## Project Structure

```text
team-drawing-canvas-sessions/
├── index.html     # Static UI
├── app.js         # Liveblocks sync and session logic
├── server.js      # Optional local preview server
├── package.json
└── README.md
```

## Run Locally

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Deploy

This project is designed to run as a static site on GitHub Pages. Liveblocks
provides the realtime collaboration layer, so no custom WebSocket server or
Render deployment is needed.

## Game Rules

1. A team creates a session link and shares it with its players.
2. Each player opens that link, enters a name, and joins the shared canvas.
3. Players draw in join order, one stroke per turn.
4. One stroke means one mouse-down to mouse-up gesture.
5. After drawing, the player clicks "Done - pass it on" to release the turn.
6. Anyone can use Undo or Clear all.
7. Save image exports the current canvas as PNG.

## Notes

- The Liveblocks public key is embedded in `app.js`.
- Strokes are stored in Liveblocks rooms named `team-drawing-canvas-cat-<session>`.
- Free Liveblocks projects are intended for prototypes and small personal use.
