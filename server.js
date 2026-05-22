// Multiplayer drawing canvas — Node.js server with zero dependencies.
// Run:    node server.js       (default port 3000, override with PORT env var)
// Open:   http://localhost:3000 yourself,
//         http://<your-LAN-IP>:3000 for others on the same Wi-Fi network.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// =================== HTTP (serves index.html) ===================
const server = http.createServer((req, res) => {
  let url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(ROOT, url);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js':   'application/javascript; charset=utf-8',
      '.css':  'text/css; charset=utf-8',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// =================== Minimal WebSocket (RFC 6455) ===================
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const clients = new Set();

server.on('upgrade', (req, socket) => {
  if ((req.headers['upgrade'] || '').toLowerCase() !== 'websocket') {
    socket.destroy(); return;
  }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  const ws = wrapSocket(socket);
  clients.add(ws);
  ws.on('close', () => { clients.delete(ws); onClose(ws); });
  ws.on('message', (str) => onMessage(ws, str));
});

function wrapSocket(socket) {
  const handlers = { message: [], close: [] };
  const ws = {
    _socket: socket,
    playerId: null,
    on(ev, fn) { handlers[ev].push(fn); },
    send(str) {
      if (socket.destroyed) return;
      const buf = encodeFrame(str);
      try { socket.write(buf); } catch {}
    },
    close() { try { socket.end(); } catch {} },
  };

  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const result = decodeFrame(buffer);
      if (!result) break;
      buffer = result.rest;
      if (result.opcode === 0x8) {            // close
        handlers.close.forEach(fn => fn());
        try { socket.end(); } catch {}
        return;
      } else if (result.opcode === 0x9) {     // ping
        const pong = Buffer.from([0x8A, 0]);
        try { socket.write(pong); } catch {}
      } else if (result.opcode === 0x1) {     // text
        const str = result.payload.toString('utf8');
        handlers.message.forEach(fn => fn(str));
      }
    }
  });

  socket.on('close', () => { handlers.close.forEach(fn => fn()); });
  socket.on('error', () => { try { socket.destroy(); } catch {} });
  return ws;
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) === 0x80;
  let len = b1 & 0x7f;
  let off = 2;
  if (len === 126) {
    if (buf.length < off + 2) return null;
    len = buf.readUInt16BE(off); off += 2;
  } else if (len === 127) {
    if (buf.length < off + 8) return null;
    len = Number(buf.readBigUInt64BE(off)); off += 8;
  }
  let mask;
  if (masked) {
    if (buf.length < off + 4) return null;
    mask = buf.slice(off, off + 4); off += 4;
  }
  if (buf.length < off + len) return null;
  let payload = buf.slice(off, off + len);
  if (masked) {
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
    payload = out;
  }
  return { opcode, payload, rest: buf.slice(off + len) };
}

function encodeFrame(str) {
  const data = Buffer.from(str, 'utf8');
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

// =================== Game state ===================
const state = {
  players: [],          // [{ id, name }]
  currentTurnIdx: 0,
  strokes: [],          // completed strokes
  drawing: null,        // active stroke
};
let nextPlayerId = 1;
let nextStrokeId = 1;

function currentTurnPlayerId() {
  if (state.players.length === 0) return null;
  return state.players[state.currentTurnIdx % state.players.length].id;
}

function broadcast(msg, exceptWs = null) {
  const json = JSON.stringify(msg);
  for (const c of clients) if (c !== exceptWs) c.send(json);
}

function sendState(ws) {
  ws.send(JSON.stringify({
    type: 'state',
    players: state.players,
    currentTurnPlayerId: currentTurnPlayerId(),
    strokes: state.strokes,
    strokeCount: state.strokes.length,
    yourId: ws.playerId,
  }));
}

function broadcastPlayers() {
  broadcast({
    type: 'players',
    players: state.players,
    currentTurnPlayerId: currentTurnPlayerId(),
  });
}

function advanceTurn() {
  if (state.players.length === 0) return;
  state.currentTurnIdx = (state.currentTurnIdx + 1) % state.players.length;
  broadcast({ type: 'turn_change', currentTurnPlayerId: currentTurnPlayerId() });
}

function onMessage(ws, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  switch (msg.type) {
    case 'join': {
      const name = String(msg.name || '').trim().slice(0, 30) || 'Anon';
      const player = { id: nextPlayerId++, name };
      state.players.push(player);
      ws.playerId = player.id;
      sendState(ws);
      broadcastPlayers();
      break;
    }
    case 'stroke_start': {
      if (ws.playerId !== currentTurnPlayerId()) return;
      if (state.drawing) return;
      state.drawing = {
        id: nextStrokeId++,
        playerId: ws.playerId,
        playerName: state.players.find(p => p.id === ws.playerId)?.name || '',
        color: String(msg.color || '#000'),
        width: Number(msg.width) || 4,
        points: [{ x: msg.x, y: msg.y }],
      };
      broadcast({ type: 'stroke_start', stroke: state.drawing });
      break;
    }
    case 'stroke_point': {
      if (!state.drawing || state.drawing.playerId !== ws.playerId) return;
      const p = { x: msg.x, y: msg.y };
      state.drawing.points.push(p);
      broadcast({ type: 'stroke_point', x: p.x, y: p.y }, ws);
      break;
    }
    case 'stroke_end': {
      if (!state.drawing || state.drawing.playerId !== ws.playerId) return;
      state.strokes.push(state.drawing);
      const finished = state.drawing;
      state.drawing = null;
      broadcast({ type: 'stroke_end', stroke: finished, strokeCount: state.strokes.length });
      break;
    }
    case 'pass_turn': {
      if (ws.playerId !== currentTurnPlayerId()) return;
      if (state.drawing) return;
      advanceTurn();
      break;
    }
    case 'undo': {
      if (state.strokes.length === 0) return;
      state.strokes.pop();
      broadcast({ type: 'undo', strokes: state.strokes, strokeCount: state.strokes.length });
      break;
    }
    case 'clear': {
      state.strokes = [];
      state.drawing = null;
      broadcast({ type: 'clear', strokeCount: 0 });
      break;
    }
  }
}

function onClose(ws) {
  if (ws.playerId == null) return;
  const idx = state.players.findIndex(p => p.id === ws.playerId);
  if (idx === -1) return;

  if (state.drawing && state.drawing.playerId === ws.playerId) {
    state.drawing = null;
    broadcast({ type: 'stroke_cancel' });
  }

  const wasTurn = state.players[state.currentTurnIdx]?.id === ws.playerId;
  state.players.splice(idx, 1);

  if (state.players.length === 0) {
    state.currentTurnIdx = 0;
  } else {
    if (idx < state.currentTurnIdx) state.currentTurnIdx -= 1;
    state.currentTurnIdx = state.currentTurnIdx % state.players.length;
    if (wasTurn) {
      broadcast({ type: 'turn_change', currentTurnPlayerId: currentTurnPlayerId() });
    }
  }
  broadcastPlayers();
}

// =================== Start ===================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🐱 Drawing canvas server is running.`);
  console.log(`   Local:    http://localhost:${PORT}`);
  const ifaces = require('os').networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name]) {
      if (i.family === 'IPv4' && !i.internal) {
        console.log(`   Network:  http://${i.address}:${PORT}`);
      }
    }
  }
  console.log('\nPress Ctrl+C to stop.\n');
});
