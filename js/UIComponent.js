import { el, icon } from './dom.js';

/**
 * Базовый класс карточки-виджета.
 * Подклассы переопределяют renderBody(body), getState() и (при необходимости) onDestroy().
 */
export class UIComponent {
  static type = 'component';

  constructor(id, title, { collapsed = false } = {}) {
    this.id = id;
    this.title = title;
    this.collapsed = Boolean(collapsed);

    this.element = null;
    this.body = null;

    // Заполняются панелью
    this.onRemove = null;
    this.onChange = null;

    this._destroyed = false;
    this._abort = new AbortController(); // один сигнал на все обработчики карточки
    this._timers = new Set();
  }

  get type() {
    return this.constructor.type;
  }

  /** Все обработчики вешаются с { signal: this.signal } и снимаются в destroy(). */
  get signal() {
    return this._abort.signal;
  }

  render() {
    if (this.element) return this.element;

    const titleId = `${this.id}-title`;
    const contentId = `${this.id}-content`;

    this.collapseBtn = el('button', {
      class: 'icon-btn collapse-btn',
      type: 'button',
      attrs: {
        'aria-controls': contentId,
        'aria-label': `Развернуть или свернуть: ${this.title}`
      }
    }, icon('chevron'));

    this.removeBtn = el('button', {
      class: 'icon-btn icon-btn--danger',
      type: 'button',
      title: 'Удалить виджет',
      attrs: { 'aria-label': `Удалить виджет: ${this.title}` }
    }, icon('close'));

    const header = el('header', { class: 'card__header' },
      el('h2', { class: 'card__title', id: titleId, text: this.title }),
      el('div', { class: 'card__actions' }, this.collapseBtn, this.removeBtn)
    );

    this.body = el('div', { class: 'card__body' });
    this.collapseEl = el('div', { class: 'card__collapse', id: contentId },
      el('div', { class: 'card__collapse-inner' }, this.body)
    );

    this.element = el('article', {
      class: `card card--${this.type}`,
      dataset: { widgetId: this.id },
      attrs: { 'aria-labelledby': titleId }
    }, header, this.collapseEl);

    this.collapseBtn.addEventListener('click', () => this.toggle(), { signal: this.signal });
    this.removeBtn.addEventListener('click', () => this.onRemove?.(this), { signal: this.signal });

    this._applyCollapsed();

    // Ошибка внутри одной карточки не должна ломать остальные
    try {
      this.renderBody(this.body);
    } catch (err) {
      console.error(`Ошибка виджета «${this.title}»:`, err);
      this.renderFailure();
    }

    return this.element;
  }

  /** Переопределяется в подклассах. */
  renderBody(body) {
    body.append(el('p', { class: 'note', text: 'Пустой виджет' }));
  }

  renderFailure() {
    this.body.replaceChildren(
      el('div', { class: 'state state--error', attrs: { role: 'alert' } },
        el('p', { class: 'state__msg', text: 'Не удалось отобразить этот виджет. Остальные работают как обычно.' })
      )
    );
  }

  toggle() {
    this.setCollapsed(!this.collapsed);
  }

  setCollapsed(value) {
    this.collapsed = Boolean(value);
    this._applyCollapsed();
    this.emitChange();
  }

  _applyCollapsed() {
    if (!this.element) return;
    this.element.classList.toggle('is-collapsed', this.collapsed);
    // inert: свёрнутое содержимое недоступно для Tab и скринридеров
    this.collapseEl.toggleAttribute('inert', this.collapsed);
    this.collapseBtn.setAttribute('aria-expanded', String(!this.collapsed));
    this.collapseBtn.title = this.collapsed ? 'Развернуть' : 'Свернуть';
  }

  /** Состояние для localStorage. Подклассы переопределяют. */
  getState() {
    return {};
  }

  serialize() {
    return { id: this.id, type: this.type, collapsed: this.collapsed, state: this.getState() };
  }

  emitChange() {
    if (!this._destroyed) this.onChange?.(this);
  }

  /** Таймер, который гарантированно останавливается в destroy(). */
  setTimer(callback, delay) {
    const timerId = setTimeout(() => {
      this._timers.delete(timerId);
      callback();
    }, delay);
    this._timers.add(timerId);
    return timerId;
  }

  clearTimer(timerId) {
    clearTimeout(timerId);
    this._timers.delete(timerId);
  }

  /** Хук для подклассов: остановить аудио, отменить запросы и т.п. */
  onDestroy() {}

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this._abort.abort(); // снимает все обработчики, добавленные с signal

    for (const timerId of this._timers) clearTimeout(timerId);
    this._timers.clear();

    this.onDestroy();

    this.element?.remove();
    this.element = null;
    this.body = null;
    this.collapseEl = null;
    this.collapseBtn = null;
    this.removeBtn = null;
    this.onRemove = null;
    this.onChange = null;
  }
}