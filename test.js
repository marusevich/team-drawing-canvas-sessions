// Smoke test: two players, verify turn queue, strokes, undo, clear.
// Run: `node server.js` in one terminal, then `node test.js` in another.

const log = (label, msg) => console.log(`[${label}]`, msg);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function connect(name) {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3000');
    const inbox = [];
    ws.player = name;
    ws.inbox = inbox;
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'join', name }));
    });
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      inbox.push(m);
      if (m.type === 'state') { ws.myId = m.yourId; resolve(ws); }
    });
    ws.addEventListener('error', e => log(name, 'ERR ' + e.message));
  });
}

function flush(ws) { const x = ws.inbox.slice(); ws.inbox.length = 0; return x; }

async function waitFor(ws, predicate, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = ws.inbox.find(predicate);
    if (found) return found;
    await sleep(30);
  }
  throw new Error(`Timeout waiting for ${predicate}`);
}

(async () => {
  let pass = 0, fail = 0;
  const check = (label, cond) => { if (cond) { pass++; log('PASS', label); } else { fail++; log('FAIL', label); } };

  const alice = await connect('Alice');
  const bob   = await connect('Bob');
  await sleep(100);

  flush(alice); flush(bob);

  // Alice goes first
  alice.send(JSON.stringify({ type: 'stroke_start', x: 10, y: 10, color: '#000', width: 4 }));
  const ssAlice = await waitFor(alice, m => m.type === 'stroke_start');
  check('stroke_start broadcast received', ssAlice && ssAlice.stroke.playerId === alice.myId);

  // Bob tries to draw when it's not his turn — should be ignored
  bob.send(JSON.stringify({ type: 'stroke_start', x: 50, y: 50, color: '#f00', width: 4 }));
  await sleep(120);
  const bobBlocked = !bob.inbox.find(m => m.type === 'stroke_start' && m.stroke.playerId === bob.myId);
  check('Bob cannot start a stroke when not his turn', bobBlocked);

  // Alice adds points and finishes
  alice.send(JSON.stringify({ type: 'stroke_point', x: 20, y: 20 }));
  alice.send(JSON.stringify({ type: 'stroke_point', x: 30, y: 25 }));
  alice.send(JSON.stringify({ type: 'stroke_end' }));
  const seAlice = await waitFor(alice, m => m.type === 'stroke_end');
  check('stroke_end received', seAlice.strokeCount === 1);

  // Pass turn
  alice.send(JSON.stringify({ type: 'pass_turn' }));
  const tc = await waitFor(bob, m => m.type === 'turn_change');
  check('Turn passed to Bob', tc.currentTurnPlayerId === bob.myId);

  // Bob draws
  flush(alice); flush(bob);
  bob.send(JSON.stringify({ type: 'stroke_start', x: 100, y: 100, color: '#f00', width: 6 }));
  bob.send(JSON.stringify({ type: 'stroke_point', x: 120, y: 110 }));
  bob.send(JSON.stringify({ type: 'stroke_end' }));
  const seBob = await waitFor(alice, m => m.type === 'stroke_end');
  check('Bob stroke broadcast to Alice', seBob.strokeCount === 2 && seBob.stroke.playerId === bob.myId);

  // Undo
  flush(alice); flush(bob);
  alice.send(JSON.stringify({ type: 'undo' }));
  const undo = await waitFor(bob, m => m.type === 'undo');
  check('Undo removes last stroke', undo.strokeCount === 1);

  // Clear
  flush(alice); flush(bob);
  bob.send(JSON.stringify({ type: 'clear' }));
  const cl = await waitFor(alice, m => m.type === 'clear');
  check('Clear empties strokes', cl.strokeCount === 0);

  // Carol joins then disconnects — player list should update
  flush(alice); flush(bob);
  const carol = await connect('Carol');
  await sleep(80);
  flush(alice); flush(bob);
  carol.close();
  await sleep(150);
  const playersMsg = alice.inbox.find(m => m.type === 'players');
  check('Carol removed from players list', playersMsg && playersMsg.players.every(p => p.name !== 'Carol'));

  console.log(`\nResult: ${pass} passed, ${fail} failed.`);
  alice.close(); bob.close();
  process.exit(fail === 0 ? 0 : 1);
})();
