const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function renderMarkdown(raw: string): string {
  const normalized = raw.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';

  const codeBlockRegistry = new Map<string, string>();
  const text = normalized.replace(/```([\w-]+)?\n?([\s\S]*?)```/g, (_match, language, code) => {
    const token = createToken('code-block', codeBlockRegistry.size);
    const languageLabel = typeof language === 'string' ? language.trim() : '';
    const escapedCode = escapeHtml(String(code ?? '').replace(/\n$/, ''));
    const languageBadge = languageLabel
      ? `<div class="markdown-code-block__lang">${escapeHtml(languageLabel)}</div>`
      : '';
    codeBlockRegistry.set(
      token,
      `<pre class="markdown-code-block">${languageBadge}<code>${escapedCode}</code></pre>`
    );
    return `\n${token}\n`;
  });

  const blocks = text
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => renderMarkdownBlock(block, codeBlockRegistry));

  return blocks.join('');
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdownBlock(block: string, codeBlockRegistry: Map<string, string>) {
  const codeBlock = codeBlockRegistry.get(block);
  if (codeBlock) return codeBlock;

  const heading = block.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    const level = Math.min(heading[1].length, 6);
    return `<h${level}>${renderInlineMarkdown(heading[2], codeBlockRegistry)}</h${level}>`;
  }

  if (block.split('\n').every(line => /^\s*>\s?/.test(line))) {
    const content = block
      .split('\n')
      .map(line => line.replace(/^\s*>\s?/, ''))
      .join('\n');
    return `<blockquote>${renderInlineMarkdown(content, codeBlockRegistry)}</blockquote>`;
  }

  if (block.split('\n').every(line => /^\s*[-*+]\s+/.test(line))) {
    const items = block
      .split('\n')
      .map(line => line.replace(/^\s*[-*+]\s+/, '').trim())
      .filter(Boolean)
      .map(line => `<li>${renderInlineMarkdown(line, codeBlockRegistry)}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  }

  if (block.split('\n').every(line => /^\s*\d+\.\s+/.test(line))) {
    const items = block
      .split('\n')
      .map(line => line.replace(/^\s*\d+\.\s+/, '').trim())
      .filter(Boolean)
      .map(line => `<li>${renderInlineMarkdown(line, codeBlockRegistry)}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  }

  return `<p>${renderInlineMarkdown(block, codeBlockRegistry)}</p>`;
}

function renderInlineMarkdown(value: string, codeBlockRegistry: Map<string, string>) {
  const codeSpanRegistry = new Map<string, string>();
  let output = escapeHtml(value);

  output = output.replace(/`([^`]+)`/g, (_match, code) => {
    const token = createToken('code-span', codeSpanRegistry.size);
    codeSpanRegistry.set(token, `<code>${escapeHtml(String(code ?? ''))}</code>`);
    return token;
  });

  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const safeHref = sanitizeMarkdownUrl(String(href ?? ''));
    if (!safeHref) return label;
    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${label}</a>`;
  });

  output = output
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br />');

  for (const [token, html] of codeSpanRegistry) {
    output = output.split(token).join(html);
  }

  for (const [token, html] of codeBlockRegistry) {
    output = output.split(token).join(html);
  }

  return output;
}

function sanitizeMarkdownUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function createToken(type: string, index: number) {
  return `@@PULSECORE_${type.toUpperCase()}_${index}@@`;
}
