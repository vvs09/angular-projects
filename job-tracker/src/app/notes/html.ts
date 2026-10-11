/** Tags the editor can produce. Anything else is unwrapped to its text, so pasted content keeps its words but not its styling. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'blockquote', 'pre', 'ul', 'ol', 'li',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'a',
]);

/** Tags whose content is never readable text, so they are dropped along with everything inside them. */
const DROPPED_TAGS = new Set([
  'script', 'style', 'template', 'iframe', 'object', 'embed', 'noscript', 'svg', 'math',
  'head', 'title', 'meta', 'link', 'img', 'video', 'audio', 'canvas', 'input', 'button', 'select', 'textarea',
]);

const BLOCK_TAGS = 'p, h1, h2, h3, blockquote, pre, li, div, br';

export function isSafeUrl(href: string): boolean {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

/**
 * Reduces HTML to the editor's allowlist: no attributes except safe link targets, no scripts, styles or embeds.
 * Parsing happens in an inert <template>, so nothing in the input runs or loads while it is cleaned.
 */
export function sanitizeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  clean(template.content);
  return template.innerHTML.trim();
}

function clean(parent: Node): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      continue;
    }
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (DROPPED_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    clean(el);
    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    // Chrome nests lists started inside a paragraph as <p><ul>, which parsing splits into stray empty <p></p> gaps.
    if (tag === 'p' && !el.hasChildNodes()) {
      el.remove();
      continue;
    }
    const href = tag === 'a' ? el.getAttribute('href') : null;
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    if (href && isSafeUrl(href)) {
      el.setAttribute('href', href);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

/** The non-empty lines of an HTML fragment, one per block, for titles and previews. */
export function toLines(html: string): string[] {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const block of Array.from(template.content.querySelectorAll(BLOCK_TAGS))) block.after('\n');
  return (template.content.textContent ?? '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
