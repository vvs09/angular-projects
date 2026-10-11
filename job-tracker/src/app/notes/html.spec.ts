import { isSafeUrl, sanitizeHtml, toLines } from './html';

describe('sanitizeHtml', () => {
  it('keeps the formatting the editor produces', () => {
    const html = '<h2>Plan</h2><p><b>Bold</b>, <i>italic</i> and <u>under</u></p><ul><li>One</li></ul><blockquote>Quote</blockquote>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('drops scripts and styles together with their content', () => {
    expect(sanitizeHtml('<p>Hi</p><script>alert(1)</script><style>p{color:red}</style>')).toBe('<p>Hi</p>');
  });

  it('strips every attribute, including event handlers and inline styles', () => {
    expect(sanitizeHtml('<p class="x" style="color:red" onclick="alert(1)">Text</p>')).toBe('<p>Text</p>');
  });

  it('unwraps unknown tags but keeps their text', () => {
    expect(sanitizeHtml('<p><span style="font-weight:700">Word</span> <font color="red">art</font></p>')).toBe('<p>Word art</p>');
  });

  it('drops images, embeds and comments', () => {
    expect(sanitizeHtml('<!--StartFragment--><p>A<img src=x onerror="alert(1)"></p><iframe src="https://evil.test"></iframe>')).toBe('<p>A</p>');
  });

  it('repairs lists that the browser nested inside a paragraph', () => {
    expect(sanitizeHtml('<h2>List</h2><p><ul><li>Milk</li></ul></p><p><br></p>')).toBe('<h2>List</h2><ul><li>Milk</li></ul><p><br></p>');
  });

  it('keeps safe links and opens them in a new tab', () => {
    expect(sanitizeHtml('<a href="https://angular.dev" title="t">Docs</a>')).toBe(
      '<a href="https://angular.dev" target="_blank" rel="noopener noreferrer">Docs</a>',
    );
  });

  it('removes the target of links that could run code', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">Click</a>')).toBe('<a>Click</a>');
  });
});

describe('isSafeUrl', () => {
  it('accepts web and mail links only', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('mailto:me@example.com')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,hi')).toBe(false);
    expect(isSafeUrl('example.com')).toBe(false);
  });
});

describe('toLines', () => {
  it('splits blocks into trimmed lines and skips empty ones', () => {
    expect(toLines('<h1>Title</h1><p><br></p><p>First  <b>line</b></p><ul><li>a</li><li>b</li></ul>')).toEqual([
      'Title',
      'First line',
      'a',
      'b',
    ]);
  });

  it('returns nothing for an empty note', () => {
    expect(toLines('<p><br></p>')).toEqual([]);
  });
});
