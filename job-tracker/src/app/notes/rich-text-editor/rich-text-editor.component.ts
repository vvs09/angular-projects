import { Component, ElementRef, afterRenderEffect, computed, input, model, signal, viewChild } from '@angular/core';
import { isSafeUrl, sanitizeHtml } from '../html';

type Block = 'p' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'pre';
type ToggleCommand = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList';

const EMPTY_DOC = '<p><br></p>';
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

/**
 * A dependency-free rich text editor on top of contenteditable.
 *
 * Formatting goes through document.execCommand. It is marked deprecated, but every browser still ships it and it is
 * the only way to get formatting that joins the browser's native undo stack without a library.
 */
@Component({
  selector: 'app-rich-text-editor',
  templateUrl: './rich-text-editor.component.html',
  host: { class: 'rte', '(document:selectionchange)': 'onSelectionChange()' },
})
export class RichTextEditorComponent {
  /** The document as HTML. Incoming values are sanitized before they reach the page. */
  readonly value = model('');
  readonly label = input('Rich text editor');
  readonly placeholder = input('Start writing…');
  readonly showCount = input(true);

  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  protected readonly blocks: { value: Block; label: string }[] = [
    { value: 'h1', label: 'Title' },
    { value: 'h2', label: 'Heading' },
    { value: 'h3', label: 'Subheading' },
    { value: 'p', label: 'Body' },
    { value: 'blockquote', label: 'Block Quote' },
    { value: 'pre', label: 'Monostyled' },
  ];
  protected readonly marks: { command: ToggleCommand; label: string; glyph: string }[] = [
    { command: 'bold', label: `Bold (${MOD}B)`, glyph: 'B' },
    { command: 'italic', label: `Italic (${MOD}I)`, glyph: 'I' },
    { command: 'underline', label: `Underline (${MOD}U)`, glyph: 'U' },
    { command: 'strikeThrough', label: `Strikethrough (${MOD}Shift+X)`, glyph: 'S' },
  ];
  /** 24×24 stroke icons, drawn inline so the toolbar needs no icon package. */
  protected readonly icons = {
    bulleted: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
    numbered: 'M10 6h10M10 12h10M10 18h10M4 4h1v4M4 8h2M6 20H4c0-1.2 2-1.8 2-3a1 1 0 0 0-2 0',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    clear: 'M4 7V4h16v3M9 20h3M13 4 8.5 20M15 15l5 5M20 15l-5 5',
    undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  };
  protected readonly lists: { command: ToggleCommand; label: string; icon: string }[] = [
    { command: 'insertUnorderedList', label: 'Bulleted list', icon: this.icons.bulleted },
    { command: 'insertOrderedList', label: 'Numbered list', icon: this.icons.numbered },
  ];
  protected readonly linkLabel = `Link (${MOD}K)`;
  protected readonly undoLabel = `Undo (${MOD}Z)`;
  protected readonly redoLabel = `Redo (${MOD}Shift+Z)`;

  protected readonly pressed = signal<Partial<Record<ToggleCommand, boolean>>>({});
  protected readonly block = signal<Block>('p');
  protected readonly blockLabel = computed(() => this.blocks.find((b) => b.value === this.block())!.label);
  protected readonly inLink = signal(false);
  protected readonly text = signal('');
  protected readonly isEmpty = signal(true);
  protected readonly words = computed(() => this.text().split(/\s+/).filter(Boolean).length);
  protected readonly characters = computed(() => this.text().replace(/\n/g, '').length);

  /** The HTML this editor last emitted, so echoes of our own edits don't rewrite the DOM and reset the caret. */
  private lastEmitted: string | null = null;
  /** The selection inside the editor, kept so toolbar controls that take focus (the style menu, link prompt) act on it. */
  private savedRange: Range | null = null;

  constructor() {
    afterRenderEffect(() => {
      const value = this.value();
      if (value === this.lastEmitted) return;
      this.content().nativeElement.innerHTML = sanitizeHtml(value) || EMPTY_DOC;
      this.lastEmitted = value;
      this.savedRange = null;
      this.measure();
    });
  }

  protected onFocus(): void {
    // Both are document-wide settings: make Enter create <p> rather than <div>, and formatting use tags rather than inline styles.
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand('styleWithCSS', false, 'false');
  }

  protected onInput(): void {
    const html = this.content().nativeElement.innerHTML;
    this.lastEmitted = html;
    this.value.set(html);
    this.measure();
    this.refreshState();
  }

  protected onSelectionChange(): void {
    const selection = document.getSelection();
    if (!selection?.rangeCount || !this.content().nativeElement.contains(selection.anchorNode)) return;
    this.savedRange = selection.getRangeAt(0).cloneRange();
    this.refreshState();
  }

  /** Keeps focus and the selection in the editor when a toolbar button is pressed. */
  protected keepSelection(event: MouseEvent): void {
    if ((event.target as Element).closest('button')) event.preventDefault();
  }

  protected toggle(command: ToggleCommand): void {
    this.exec(command);
  }

  protected setBlock(block: Block): void {
    this.exec('formatBlock', `<${block}>`);
  }

  protected exec(command: string, value?: string): void {
    this.restoreSelection();
    document.execCommand(command, false, value);
    this.refreshState();
  }

  protected editLink(): void {
    const existing = this.closestInSelection('a');
    const answer = prompt('Link address (leave empty to remove the link)', existing?.getAttribute('href') ?? 'https://');
    if (answer === null) return;

    // Act on the whole link when the caret is just inside one, so editing or removing it covers all of its text.
    if (existing && this.savedRange?.collapsed) {
      this.savedRange = document.createRange();
      this.savedRange.selectNodeContents(existing);
    }

    const typed = answer.trim();
    if (!typed || typed === 'https://') {
      if (existing) this.exec('unlink');
      return;
    }
    const href = /^[a-z][a-z\d+.-]*:/i.test(typed) ? typed : `https://${typed}`;
    if (!isSafeUrl(href)) {
      alert('Links must start with http://, https:// or mailto:.');
      return;
    }

    if (this.savedRange && !this.savedRange.collapsed) {
      this.exec('createLink', href);
    } else {
      // Nothing selected: insert the address itself as the link text.
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.textContent = typed;
      this.exec('insertHTML', anchor.outerHTML);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === 'k') {
      event.preventDefault();
      this.editLink();
    } else if (mod && event.shiftKey && key === 'x') {
      event.preventDefault();
      this.exec('strikeThrough');
    } else if (event.key === 'Tab' && this.closestInSelection('li')) {
      // Nest list items; outside lists Tab keeps moving focus, so keyboard users aren't trapped in the editor.
      event.preventDefault();
      this.exec(event.shiftKey ? 'outdent' : 'indent');
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const data = event.clipboardData;
    if (!data) return;
    event.preventDefault();
    const html = data.getData('text/html');
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
    else document.execCommand('insertText', false, data.getData('text/plain'));
  }

  private restoreSelection(): void {
    const el = this.content().nativeElement;
    el.focus({ preventScroll: true });
    const selection = document.getSelection();
    if (this.savedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(this.savedRange);
    }
  }

  private refreshState(): void {
    const state: Partial<Record<ToggleCommand, boolean>> = {};
    for (const { command } of [...this.marks, ...this.lists]) state[command] = document.queryCommandState(command);
    this.pressed.set(state);
    const block = document.queryCommandValue('formatBlock').toLowerCase();
    this.block.set(this.blocks.some((b) => b.value === block) ? (block as Block) : 'p');
    this.inLink.set(!!this.closestInSelection('a'));
  }

  private closestInSelection(selector: string): Element | null {
    const node = this.savedRange?.commonAncestorContainer;
    const element = node instanceof Element ? node : node?.parentElement;
    const found = element?.closest(selector);
    return found && this.content().nativeElement.contains(found) ? found : null;
  }

  private measure(): void {
    const el = this.content().nativeElement;
    // innerText respects line breaks between blocks; textContent is the fallback where layout isn't available.
    const text = el.innerText ?? el.textContent ?? '';
    this.text.set(text);
    this.isEmpty.set(!text.trim() && !el.querySelector('li, blockquote, pre, h1, h2, h3'));
  }
}
