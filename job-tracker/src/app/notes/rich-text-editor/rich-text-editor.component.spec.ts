import { TestBed } from '@angular/core/testing';
import { RichTextEditorComponent } from './rich-text-editor.component';

describe('RichTextEditorComponent', () => {
  beforeEach(() => {
    // jsdom has no editing commands; the editor only reads them to highlight the toolbar.
    Object.assign(document, { queryCommandState: () => false, queryCommandValue: () => '' });
  });

  async function render(value: string) {
    const fixture = TestBed.createComponent(RichTextEditorComponent);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    const content = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.rte-content')!;
    return { fixture, content };
  }

  it('sanitizes the value before rendering it', async () => {
    const { content } = await render('<p onclick="alert(1)">Hi <b>there</b></p><script>alert(1)</script>');
    expect(content.innerHTML).toBe('<p>Hi <b>there</b></p>');
  });

  it('starts an empty document with a paragraph and shows the placeholder', async () => {
    const { content } = await render('');
    expect(content.innerHTML).toBe('<p><br></p>');
    expect(content.classList).toContain('is-empty');
  });

  it('emits edits as HTML and counts words', async () => {
    const { fixture, content } = await render('');
    const emitted: string[] = [];
    fixture.componentInstance.value.subscribe((html) => emitted.push(html));

    content.innerHTML = '<p>Two words</p>';
    content.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitted).toEqual(['<p>Two words</p>']);
    expect(content.classList).not.toContain('is-empty');
    expect((fixture.nativeElement as HTMLElement).querySelector('.rte-foot')!.textContent).toContain('2 words');
  });
});
