import { Injectable, OnDestroy, signal } from '@angular/core';
import { applyServerMessage, createBoardState, lastStrokeBy } from './board-state';
import { ClientMessage, Peer, ServerMessage, Stroke } from './whiteboard.model';

export type ConnectionStatus = 'connecting' | 'live' | 'offline';

/** Keeps one room's board in sync over a WebSocket. Provided per whiteboard so leaving the page disconnects. */
@Injectable()
export class WhiteboardSyncService implements OnDestroy {
  /** Chosen by the client so ownership (and undo) survives reconnects. */
  readonly selfId = crypto.randomUUID();
  readonly state = createBoardState();

  readonly status = signal<ConnectionStatus>('connecting');
  readonly peers = signal<Peer[]>([]);
  /** Bumped whenever strokes change; the canvas redraws in response. Strokes are mutated in place for speed. */
  readonly version = signal(0);

  private socket?: WebSocket;
  private room = '';
  private profile = { name: '', color: '' };
  private retries = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  connect(room: string, profile: { name: string; color: string }): void {
    this.room = room;
    this.profile = profile;
    this.open();
  }

  setProfile(profile: { name: string; color: string }): void {
    this.profile = profile;
    this.send({ type: 'hello', ...profile });
  }

  beginStroke(stroke: Stroke): void {
    this.state.strokes.set(stroke.id, stroke);
    this.changed();
    this.send({ type: 'begin', stroke });
  }

  addPoints(id: string, points: number[]): void {
    const stroke = this.state.strokes.get(id);
    if (!stroke || points.length === 0) return;
    stroke.points.push(...points);
    this.changed();
    this.send({ type: 'points', id, points });
  }

  undo(): void {
    const stroke = lastStrokeBy(this.state, this.selfId);
    if (!stroke) return;
    this.state.strokes.delete(stroke.id);
    this.changed();
    this.send({ type: 'undo', id: stroke.id });
  }

  clear(): void {
    this.state.strokes.clear();
    this.changed();
    this.send({ type: 'clear' });
  }

  sendCursor(x: number | null, y: number | null): void {
    this.send({ type: 'cursor', x, y });
  }

  hasOwnStrokes(): boolean {
    return lastStrokeBy(this.state, this.selfId) !== undefined;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.retryTimer);
    this.socket?.close();
  }

  private open(): void {
    clearTimeout(this.retryTimer);
    this.socket?.close();
    this.status.set('connecting');

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const params = new URLSearchParams({ room: this.room, peer: this.selfId });
    const socket = new WebSocket(`${protocol}://${location.host}/ws?${params}`);
    this.socket = socket;

    socket.onopen = () => {
      this.retries = 0;
      this.status.set('live');
      this.send({ type: 'hello', ...this.profile });
    };
    socket.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      const unsynced = applyServerMessage(this.state, msg, this.selfId);
      for (const stroke of unsynced) this.send({ type: 'begin', stroke });
      if (msg.type !== 'cursor' && msg.type !== 'peer' && msg.type !== 'leave') this.changed();
      if (msg.type === 'welcome' || msg.type === 'peer' || msg.type === 'leave' || msg.type === 'cursor') {
        this.peers.set([...this.state.peers.values()]);
      }
    };
    socket.onclose = () => {
      if (this.socket !== socket || this.destroyed) return;
      this.status.set('offline');
      // Back off up to 10s so a stopped server isn't hammered.
      const delay = Math.min(10_000, 500 * 2 ** this.retries++);
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }

  private send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }

  private changed(): void {
    this.version.update((v) => v + 1);
  }
}
