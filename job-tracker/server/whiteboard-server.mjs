// Relays whiteboard strokes and cursors between everyone in the same room.
// Rooms live in memory: they survive reconnects but not a server restart.
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.WHITEBOARD_PORT ?? 4201);
const MAX_STROKES_PER_ROOM = 5000;
const MAX_POINTS_PER_STROKE = 20000; // flat [x, y, x, y, ...], so 10k points
const BOARD_W = 1600;
const BOARD_H = 1000;
const TOOLS = new Set(['pen', 'eraser']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ID = /^[\w-]{1,64}$/;

/** @type {Map<string, { strokes: Map<string, any>, clients: Map<import('ws').WebSocket, any> }>} */
const rooms = new Map();

function getRoom(id) {
  let room = rooms.get(id);
  if (!room) {
    room = { strokes: new Map(), clients: new Map() };
    rooms.set(id, room);
  }
  return room;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const ws of room.clients.keys()) {
    if (ws !== except && ws.readyState === ws.OPEN) ws.send(data);
  }
}

const isCoord = (n, max) => typeof n === 'number' && Number.isFinite(n) && n >= -max && n <= 2 * max;

function cleanPoints(points) {
  if (!Array.isArray(points) || points.length % 2 !== 0) return null;
  for (let i = 0; i < points.length; i += 2) {
    if (!isCoord(points[i], BOARD_W) || !isCoord(points[i + 1], BOARD_H)) return null;
  }
  return points;
}

function cleanStroke(stroke, userId) {
  if (!stroke || !ID.test(stroke.id) || !TOOLS.has(stroke.tool) || !HEX_COLOR.test(stroke.color)) return null;
  const size = Number(stroke.size);
  const points = cleanPoints(stroke.points);
  if (!(size > 0 && size <= 100) || !points || points.length > MAX_POINTS_PER_STROKE) return null;
  return { id: stroke.id, userId, tool: stroke.tool, color: stroke.color, size, points };
}

function cleanName(name) {
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : 'Guest';
}

const wss = new WebSocketServer({ port: PORT, path: '/ws', maxPayload: 512 * 1024 });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const roomId = url.searchParams.get('room') ?? '';
  const peerId = url.searchParams.get('peer') ?? '';
  if (!ID.test(roomId) || !ID.test(peerId)) {
    ws.close(1008, 'Invalid room or peer id');
    return;
  }

  const room = getRoom(roomId);
  const peer = { id: peerId, name: 'Guest', color: '#5a5f7d', cursor: null };
  room.clients.set(ws, peer);
  send(ws, { type: 'welcome', strokes: [...room.strokes.values()], peers: [...room.clients.values()] });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg?.type) {
      case 'hello': {
        peer.name = cleanName(msg.name);
        if (HEX_COLOR.test(msg.color)) peer.color = msg.color;
        broadcast(room, { type: 'peer', peer }, ws);
        break;
      }
      case 'begin': {
        const stroke = cleanStroke(msg.stroke, peer.id);
        if (!stroke || room.strokes.has(stroke.id) || room.strokes.size >= MAX_STROKES_PER_ROOM) return;
        room.strokes.set(stroke.id, stroke);
        broadcast(room, { type: 'begin', stroke }, ws);
        break;
      }
      case 'points': {
        const stroke = room.strokes.get(msg.id);
        const points = cleanPoints(msg.points);
        // Only the author can extend a stroke.
        if (!stroke || stroke.userId !== peer.id || !points) return;
        if (stroke.points.length + points.length > MAX_POINTS_PER_STROKE) return;
        stroke.points.push(...points);
        broadcast(room, { type: 'points', id: stroke.id, points }, ws);
        break;
      }
      case 'undo': {
        const stroke = room.strokes.get(msg.id);
        if (!stroke || stroke.userId !== peer.id) return;
        room.strokes.delete(stroke.id);
        broadcast(room, { type: 'undo', id: stroke.id }, ws);
        break;
      }
      case 'clear': {
        room.strokes.clear();
        broadcast(room, { type: 'clear', by: peer.id }, ws);
        break;
      }
      case 'cursor': {
        const visible = isCoord(msg.x, BOARD_W) && isCoord(msg.y, BOARD_H);
        // Remembered so people who join later see where everyone is pointing.
        peer.cursor = visible ? { x: msg.x, y: msg.y } : null;
        broadcast(room, { type: 'cursor', id: peer.id, x: visible ? msg.x : null, y: visible ? msg.y : null }, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    // A quick reconnect can open the new socket before the old one closes; don't announce a leave then.
    const stillHere = [...room.clients.values()].some((p) => p.id === peer.id);
    if (!stillHere) broadcast(room, { type: 'leave', id: peer.id });
    // Forget rooms nobody is in and nothing is drawn on.
    if (room.clients.size === 0 && room.strokes.size === 0) rooms.delete(roomId);
  });
});

wss.on('listening', () => console.log(`Whiteboard server listening on ws://localhost:${PORT}/ws`));
