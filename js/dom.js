const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Создаёт элемент. Текст вставляется только через textContent / text-узлы,
 * поэтому пользовательские данные не могут стать разметкой.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'attrs') {
      for (const [name, attr] of Object.entries(value)) node.setAttribute(name, attr);
    } else node[key] = value;
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

// Статичные, заранее известные иконки (никаких пользовательских данных)
const ICONS = {
  chevron: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  retry: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>'
};

export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Допустимый вид id (он попадает в атрибуты DOM)
export const SAFE_ID = /^[a-z0-9-]{1,60}$/i;

export function isHttps(url) {
  return typeof url === 'string' && url.startsWith('https://');
}

export function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}