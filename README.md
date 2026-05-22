# Team Drawing Canvas

A multiplayer, turn-based drawing canvas for team events. Players take turns
drawing one stroke each on a shared canvas. The goal is to draw a cat together.

## Stack

- Frontend: plain HTML, CSS, and JavaScript
- Realtime sync: Liveblocks Storage and Presence
- Hosting: GitHub Pages
- Local preview: optional Node.js static file server

## Project Structure

```text
team-drawing-canvas/
├── index.html
├── app.js
├── server.js
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

1. Each player enters a name and joins the shared canvas.
2. Players draw in join order, one stroke per turn.
3. One stroke means one mouse-down to mouse-up gesture.
4. After drawing, the player clicks "Done - pass it on" to release the turn.
5. Anyone can use Undo or Clear all.
6. Save image exports the current canvas as PNG.

## Notes

- The Liveblocks public key is embedded in `app.js`.
- Strokes are stored in the Liveblocks room named `team-drawing-canvas-cat`.
- Free Liveblocks projects are intended for prototypes and small personal use.
