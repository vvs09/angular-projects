import { Peer, ServerMessage, Stroke } from './whiteboard.model';

export interface BoardState {
  /** Insertion order is drawing order, which matters for the eraser. */
  strokes: Map<string, Stroke>;
  peers: Map<string, Peer>;
}

export function createBoardState(): BoardState {
  return { strokes: new Map(), peers: new Map() };
}

/**
 * Applies a server message to the board in place.
 * Returns strokes drawn locally while disconnected that the server hasn't seen, so the caller can resend them.
 */
export function applyServerMessage(state: BoardState, msg: ServerMessage, selfId: string): Stroke[] {
  switch (msg.type) {
    case 'welcome': {
      const known = new Set(msg.strokes.map((s) => s.id));
      const unsynced = [...state.strokes.values()].filter((s) => s.userId === selfId && !known.has(s.id));
      state.strokes = new Map([...msg.strokes, ...unsynced].map((s) => [s.id, s]));
      state.peers = new Map(msg.peers.filter((p) => p.id !== selfId).map((p) => [p.id, p]));
      return unsynced;
    }
    case 'peer':
      if (msg.peer.id !== selfId) {
        state.peers.set(msg.peer.id, { ...state.peers.get(msg.peer.id), ...msg.peer });
      }
      break;
    case 'leave':
      state.peers.delete(msg.id);
      break;
    case 'begin':
      state.strokes.set(msg.stroke.id, msg.stroke);
      break;
    case 'points':
      state.strokes.get(msg.id)?.points.push(...msg.points);
      break;
    case 'undo':
      state.strokes.delete(msg.id);
      break;
    case 'clear':
      state.strokes.clear();
      break;
    case 'cursor': {
      const peer = state.peers.get(msg.id);
      if (peer) peer.cursor = msg.x == null || msg.y == null ? null : { x: msg.x, y: msg.y };
      break;
    }
  }
  return [];
}

/** The most recent stroke this user drew, which is what undo removes. */
export function lastStrokeBy(state: BoardState, userId: string): Stroke | undefined {
  return [...state.strokes.values()].reverse().find((s) => s.userId === userId);
}
