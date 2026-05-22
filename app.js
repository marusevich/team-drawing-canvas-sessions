import { createClient, LiveList } from "https://esm.sh/@liveblocks/client?bundle";

const LIVEBLOCKS_PUBLIC_KEY = "pk_dev_fIzmJAtF9NWVLJO_NwwXNfDPlUX4hw0fYlA7XlrRMOiyidVQ1by_QyHbUJ91wP_g";
const ROOM_ID = "team-drawing-canvas-cat";
const COLORS = ["#1c1e26", "#e25c5c", "#ee9c3a", "#2bb673", "#3d8de0", "#a64cd2"];

const joinScreen = document.getElementById("joinScreen");
const gameScreen = document.getElementById("gameScreen");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const colorsBox = document.getElementById("colors");
const brushSize = document.getElementById("brushSize");
const brushSizeLabel = document.getElementById("brushSizeLabel");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const lockBanner = document.getElementById("lockBanner");
const lockText = document.getElementById("lockText");
const turnInfo = document.getElementById("turnInfo");
const strokeCountEl = document.getElementById("strokeCount");
const playersBox = document.getElementById("players");
const doneBtn = document.getElementById("doneBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");

let client = null;
let room = null;
let root = null;
let strokesList = null;
let myId = null;
let myName = "";
let players = [];
let currentTurnIndex = 0;
let currentTurnPlayerId = null;
let strokes = [];
let activeStroke = null;
let myColor = COLORS[0];
let myBrush = 6;
let isDrawing = false;
let didStroke = false;

COLORS.forEach((color, index) => {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = `swatch${index === 0 ? " active" : ""}`;
  swatch.style.background = color;
  swatch.setAttribute("aria-label", `Use color ${color}`);
  swatch.addEventListener("click", () => {
    document.querySelectorAll(".swatch").forEach(el => el.classList.remove("active"));
    swatch.classList.add("active");
    myColor = color;
  });
  colorsBox.appendChild(swatch);
});

brushSize.addEventListener("input", () => {
  myBrush = Number(brushSize.value);
  brushSizeLabel.textContent = myBrush;
});

joinBtn.addEventListener("click", join);
nameInput.addEventListener("keydown", event => {
  if (event.key === "Enter") join();
});

async function join() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  myName = name;
  joinBtn.disabled = true;
  joinBtn.textContent = "Joining…";

  try {
    client = createClient({
      publicApiKey: LIVEBLOCKS_PUBLIC_KEY,
      throttle: 32,
    });

    const entered = client.enterRoom(ROOM_ID, {
      initialPresence: { name: myName },
      initialStorage: {
        strokes: new LiveList([]),
        currentTurnIndex: 0,
      },
    });

    room = entered.room;
    joinScreen.style.display = "none";
    gameScreen.classList.add("active");
    turnInfo.textContent = "Connecting…";

    room.subscribe("status", status => {
      if (status === "reconnecting") turnInfo.textContent = "Reconnecting…";
      if (status === "disconnected") turnInfo.textContent = "Connection lost. Please reload the page.";
    });

    room.subscribe("others", () => {
      refreshPlayers();
      updateUI();
    });

    room.subscribe("event", ({ event }) => {
      handleLiveblocksEvent(event);
    });

    const storage = await room.getStorage();
    root = storage.root;
    strokesList = root.get("strokes");

    room.subscribe(root, syncFromStorage, { isDeep: true });

    syncFromStorage();
  } catch (error) {
    console.error(error);
    joinBtn.disabled = false;
    joinBtn.textContent = "Join";
    alert("Could not connect to Liveblocks. Check the public key and project settings.");
  }
}

function syncFromStorage() {
  if (!root || !strokesList) return;
  strokes = strokesList.toImmutable();
  currentTurnIndex = Number(root.get("currentTurnIndex")) || 0;
  strokeCountEl.textContent = strokes.length;
  refreshPlayers();
  redraw();
  updateUI();
}

function refreshPlayers() {
  if (!room) return;

  const self = room.getSelf();
  const nextPlayers = [];

  if (self) {
    myId = self.connectionId;
    nextPlayers.push({
      id: self.connectionId,
      name: self.presence?.name || myName || "You",
    });
  }

  for (const other of room.getOthers()) {
    nextPlayers.push({
      id: other.connectionId,
      name: other.presence?.name || "Player",
    });
  }

  players = nextPlayers.sort((a, b) => a.id - b.id);
  currentTurnPlayerId = players.length ? players[currentTurnIndex % players.length].id : null;
}

function handleLiveblocksEvent(event) {
  switch (event.type) {
    case "stroke_start":
      activeStroke = event.stroke;
      if (activeStroke.playerId !== myId) drawStartPoint(activeStroke);
      break;
    case "stroke_point":
      if (!activeStroke || activeStroke.playerId !== event.playerId) return;
      {
        const last = activeStroke.points[activeStroke.points.length - 1];
        const point = { x: event.x, y: event.y };
        drawSegment(last, point, activeStroke.color, activeStroke.width);
        activeStroke.points.push(point);
      }
      break;
    case "stroke_end":
    case "stroke_cancel":
      activeStroke = null;
      redraw();
      break;
  }
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) drawWholeStroke(stroke);
  if (activeStroke) drawWholeStroke(activeStroke);
}

function drawWholeStroke(stroke) {
  if (!stroke.points.length) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

function drawStartPoint(stroke) {
  ctx.fillStyle = stroke.color;
  ctx.beginPath();
  ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSegment(a, b, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function canvasPos(event) {
  const rect = canvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  return {
    x: (point.clientX - rect.left) * (canvas.width / rect.width),
    y: (point.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function pointerDown(event) {
  if (!room || !strokesList) return;
  if (currentTurnPlayerId !== myId || didStroke || activeStroke) return;

  event.preventDefault();
  isDrawing = true;

  const point = canvasPos(event);
  activeStroke = {
    id: `${myId}-${Date.now()}`,
    playerId: myId,
    playerName: myName,
    color: myColor,
    width: myBrush,
    points: [point],
  };

  drawStartPoint(activeStroke);
  room.broadcastEvent({ type: "stroke_start", stroke: activeStroke });
}

function pointerMove(event) {
  if (!isDrawing || !activeStroke || !room) return;

  event.preventDefault();

  const point = canvasPos(event);
  const last = activeStroke.points[activeStroke.points.length - 1];
  if (Math.abs(point.x - last.x) < 1 && Math.abs(point.y - last.y) < 1) return;

  drawSegment(last, point, activeStroke.color, activeStroke.width);
  activeStroke.points.push(point);
  room.broadcastEvent({ type: "stroke_point", playerId: myId, x: point.x, y: point.y });
}

function pointerUp() {
  if (!isDrawing || !activeStroke || !strokesList || !room) return;

  isDrawing = false;

  const finishedStroke = {
    ...activeStroke,
    points: activeStroke.points.map(point => ({ x: point.x, y: point.y })),
  };

  strokesList.push(finishedStroke);
  activeStroke = null;
  didStroke = true;
  room.broadcastEvent({ type: "stroke_end", playerId: myId });
  updateUI();
}

canvas.addEventListener("mousedown", pointerDown);
canvas.addEventListener("mousemove", pointerMove);
window.addEventListener("mouseup", pointerUp);
canvas.addEventListener("touchstart", pointerDown);
canvas.addEventListener("touchmove", pointerMove);
window.addEventListener("touchend", pointerUp);

doneBtn.addEventListener("click", () => {
  if (!root || players.length === 0) return;
  root.set("currentTurnIndex", (currentTurnIndex + 1) % players.length);
  didStroke = false;
  updateUI();
});

undoBtn.addEventListener("click", () => {
  if (!strokesList || strokesList.length === 0) return;
  strokesList.delete(strokesList.length - 1);
});

clearBtn.addEventListener("click", () => {
  if (!strokesList || !room) return;
  if (!confirm("Clear everything?")) return;

  strokesList.clear();
  activeStroke = null;
  didStroke = false;
  room.broadcastEvent({ type: "stroke_cancel" });
  updateUI();
});

saveBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `cat-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

function updateUI() {
  refreshPlayers();

  const isMyTurn = currentTurnPlayerId === myId;
  playersBox.innerHTML = "";

  for (const player of players) {
    const pill = document.createElement("span");
    pill.className = "pill";
    if (player.id === currentTurnPlayerId) pill.classList.add("current");
    if (player.id === myId) pill.classList.add("me");
    pill.textContent = player.name;
    playersBox.appendChild(pill);
  }

  const turnPlayer = players.find(player => player.id === currentTurnPlayerId);

  if (!turnPlayer) {
    turnInfo.textContent = root ? "Waiting for players…" : "Connecting…";
  } else if (isMyTurn) {
    turnInfo.innerHTML = '<span class="my-turn">Your turn!</span> Draw one stroke and click "Done".';
  } else {
    turnInfo.innerHTML = `Currently drawing: <strong>${escapeHtml(turnPlayer.name)}</strong>`;
  }

  if (isMyTurn && !didStroke) {
    lockBanner.classList.remove("visible");
    canvas.classList.remove("locked");
  } else if (isMyTurn && didStroke) {
    lockBanner.classList.add("visible");
    lockText.textContent = 'Done! Click "Pass it on".';
    canvas.classList.add("locked");
  } else {
    lockBanner.classList.add("visible");
    lockText.textContent = turnPlayer ? `Currently drawing: ${turnPlayer.name}` : "Waiting…";
    canvas.classList.add("locked");
  }

  doneBtn.disabled = !(isMyTurn && didStroke);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}
