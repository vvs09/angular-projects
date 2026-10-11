import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toLines } from './html';
import { NotesService } from './notes.service';
import { RichTextEditorComponent } from './rich-text-editor/rich-text-editor.component';

const DAY_MS = 86_400_000;

interface NoteItem {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  isToday: boolean;
}

/** Apple Notes style buckets, relative to the start of today. */
function groupOf(updatedAt: number, startOfToday: number): string {
  if (updatedAt >= startOfToday) return 'Today';
  if (updatedAt >= startOfToday - DAY_MS) return 'Yesterday';
  if (updatedAt >= startOfToday - 7 * DAY_MS) return 'Previous 7 Days';
  if (updatedAt >= startOfToday - 30 * DAY_MS) return 'Previous 30 Days';
  return 'Earlier';
}

@Component({
  selector: 'app-notes',
  imports: [DatePipe, RichTextEditorComponent],
  templateUrl: './notes.component.html',
})
export class NotesComponent {
  protected readonly notes = inject(NotesService);
  protected readonly query = signal('');

  private readonly items = computed<NoteItem[]>(() => {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    return this.notes.notes().map((note) => {
      const [title = 'New Note', ...rest] = toLines(note.html);
      return { id: note.id, title, preview: rest.join(' '), updatedAt: note.updatedAt, isToday: note.updatedAt >= startOfToday };
    });
  });

  protected readonly count = computed(() => this.items().length);

  /** Notes matching the search, in date sections. Notes are already sorted newest first, so sections come out in order. */
  protected readonly groups = computed(() => {
    const query = this.query().trim().toLowerCase();
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const groups: { label: string; items: NoteItem[] }[] = [];
    for (const item of this.items()) {
      if (query && !`${item.title} ${item.preview}`.toLowerCase().includes(query)) continue;
      const label = groupOf(item.updatedAt, startOfToday);
      const last = groups.at(-1);
      if (last?.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  });

  create(): void {
    this.query.set('');
    this.notes.create();
  }

  remove(): void {
    if (confirm('Delete this note? This cannot be undone.')) this.notes.remove(this.notes.active().id);
  }
}
