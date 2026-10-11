import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { drawStroke, exportPng } from './render';
import { WhiteboardSyncService } from './whiteboard-sync.service';
import { BOARD_H, BOARD_W, ERASER_SIZE, PEN_COLORS, PEN_SIZES, Stroke, Tool } from './whiteboard.model';

const PROFILE_KEY = 'whiteboard.profile.v1';
const CURSOR_INTERVAL_MS = 40;

function loadProfile(): { name: string; color: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (saved?.name && saved?.color) return saved;
  } catch {
    // Fall through to a fresh identity.
  }
  // Skip the ink color so other people's cursors stand out from the default pen.
  const colors = PEN_COLORS.slice(1);
  return {
    name: `Guest ${Math.floor(100 + Math.random() * 900)}`,
    color: colors[Math.floor(Math.random() * colors.length)].value,
  };
}

@Component({
  selector: 'app-whiteboard',
  providers: [WhiteboardSyncService],
  templateUrl: './whiteboard.component.html',
  host: { '(window:keydown)': 'onKeydown($event)' },
})
export class WhiteboardComponent implements OnInit {
  /** Bound from the :room route parameter. */
  readonly room = input.required<string>();

  protected readonly sync = inject(WhiteboardSyncService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly colors = PEN_COLORS;
  protected readonly sizes = PEN_SIZES;
  protected readonly tool = signal<Tool>('pen');
  protected readonly color = signal(PEN_COLORS[0].value);
  protected readonly size = signal(PEN_SIZES[1].value);
  protected readonly profile = signal(loadProfile());
  protected readonly copied = signal(false);
  protected readonly canUndo = computed(() => (this.sync.version(), this.sync.hasOwnStrokes()));
  protected readonly isEmpty = computed(() => (this.sync.version(), this.sync.state.strokes.size === 0));
  protected readonly visibleCursors = computed(() => this.sync.peers().filter((p) => p.cursor));

  private readonly destroyRef = inject(DestroyRef);
  private drawing: Stroke | null = null;
  private lastCursorSent = 0;
  private frame = 0;

  constructor() {
    // Redraw at most once per frame, however many points arrive in between.
    effect(() => {
      this.sync.version();
      this.scheduleRender();
    });

    effect(() => {
      const profile = this.profile();
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      } catch {
        // Not critical; a new name is picked next time.
      }
      this.sync.setProfile(profile);
    });

    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.scheduleRender());
      observer.observe(this.canvas().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  ngOnInit(): void {
    this.sync.connect(this.room(), this.profile());
    this.destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));
  }

  rename(name: string): void {
    this.profile.update((p) => ({ ...p, name: name.trim().slice(0, 24) || p.name }));
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.canvas().nativeElement.setPointerCapture(event.pointerId);
    const eraser = this.tool() === 'eraser';
    this.drawing = {
      id: crypto.randomUUID(),
      userId: this.sync.selfId,
      tool: this.tool(),
      color: eraser ? '#000000' : this.color(),
      size: eraser ? ERASER_SIZE : this.size(),
      points: this.toBoard(event),
    };
    this.sync.beginStroke(this.drawing);
  }

  onPointerMove(event: PointerEvent): void {
    if (event.timeStamp - this.lastCursorSent > CURSOR_INTERVAL_MS) {
      this.lastCursorSent = event.timeStamp;
      const [x, y] = this.toBoard(event);
      this.sync.sendCursor(x, y);
    }
    if (!this.drawing) return;
    // Coalesced events recover the samples the browser merged between frames, for smoother lines.
    const samples = event.getCoalescedEvents?.() ?? [];
    const points = (samples.length ? samples : [event]).flatMap((e) => this.toBoard(e));
    this.sync.addPoints(this.drawing.id, points);
  }

  onPointerUp(): void {
    this.drawing = null;
  }

  onPointerLeave(): void {
    if (!this.drawing) this.sync.sendCursor(null, null);
  }

  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.matches('input, textarea, select')) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.sync.undo();
    } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key === 'p') this.tool.set('pen');
      if (event.key === 'e') this.tool.set('eraser');
    }
  }

  pickColor(color: string): void {
    this.color.set(color);
    this.tool.set('pen');
  }

  clear(): void {
    if (confirm('Clear the board for everyone in this room?')) this.sync.clear();
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.href);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      prompt('Copy this link to invite people:', location.href);
    }
  }

  async download(): Promise<void> {
    const blob = await exportPng(this.sync.state.strokes.values());
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${this.room()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  cursorLeft(x: number): number {
    return (x / BOARD_W) * 100;
  }

  cursorTop(y: number): number {
    return (y / BOARD_H) * 100;
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private toBoard(event: PointerEvent): [number, number] {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    // One decimal place is sub-pixel at any realistic zoom and keeps messages small.
    const round = (n: number) => Math.round(n * 10) / 10;
    return [
      round(((event.clientX - rect.left) / rect.width) * BOARD_W),
      round(((event.clientY - rect.top) / rect.height) * BOARD_H),
    ];
  }

  private scheduleRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !canvas.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(width / BOARD_W, 0, 0, height / BOARD_H, 0, 0);
    for (const stroke of this.sync.state.strokes.values()) drawStroke(ctx, stroke);
  }
}
