import { Injectable, computed, effect, signal } from '@angular/core';

export interface Note {
  id: string;
  /** Sanitized HTML from the rich text editor. */
  html: string;
  updatedAt: number;
}

const STORAGE_KEY = 'notes.v1';

const WELCOME = [
  '<h1>Welcome to Notes</h1>',
  '<p>Write with <b>bold</b>, <i>italic</i>, <u>underline</u> and <s>strikethrough</s>, or pick a style from the menu.</p>',
  '<ul><li>Lists nest with Tab and Shift+Tab</li><li>Links open in a new tab</li></ul>',
  '<blockquote>Pasted text keeps its structure but loses outside styling.</blockquote>',
].join('');

function newNote(html = ''): Note {
  return { id: crypto.randomUUID(), html, updatedAt: Date.now() };
}

function load(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return [newNote(WELCOME)];
}

@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly state = signal<Note[]>(load());
  private readonly openId = signal<string | null>(null);

  /** Most recently edited first. */
  readonly notes = computed(() => [...this.state()].sort((a, b) => b.updatedAt - a.updatedAt));
  readonly active = computed(() => this.notes().find((n) => n.id === this.openId()) ?? this.notes()[0]);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
      } catch {
        // Ignore quota or privacy-mode failures; the app still works in memory.
      }
    });
  }

  open(id: string): void {
    this.openId.set(id);
  }

  create(): void {
    const note = newNote();
    this.state.update((notes) => [...notes, note]);
    this.openId.set(note.id);
  }

  update(id: string, html: string): void {
    this.state.update((notes) => notes.map((n) => (n.id === id && n.html !== html ? { ...n, html, updatedAt: Date.now() } : n)));
  }

  /** There is always at least one note, so deleting the last one leaves a blank page rather than an empty screen. */
  remove(id: string): void {
    const rest = this.state().filter((n) => n.id !== id);
    this.state.set(rest.length ? rest : [newNote()]);
    if (this.openId() === id) this.openId.set(null);
  }
}
