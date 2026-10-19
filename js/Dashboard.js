import { ToDoWidget } from './ToDoWidget.js';
import { ArtistWidget } from './ArtistWidget.js';
import { AboutWidget } from './AboutWidget.js';
import { uid, SAFE_ID } from './dom.js';
import { loadState, saveState, isStorageAvailable } from './storage.js';

export const WIDGET_TYPES = Object.freeze({
  todo: { label: 'Список дел', Class: ToDoWidget },
  artist: { label: 'Исполнитель', Class: ArtistWidget },
  about: { label: 'Об артисте', Class: AboutWidget }
});

const DEMO_TASKS = [
  { text: 'Послушать новый альбом любимой группы', done: false },
  { text: 'Собрать плейлист для поездки', done: true },
  { text: 'Выучить аккорды к одной песне', done: false }
];

export class Dashboard {
  constructor({ board, emptyState, hint, buttons }) {
    this.board = board;
    this.emptyState = emptyState;
    this.hintEl = hint;

    this.buttons = new Map();
    for (const button of buttons) this.buttons.set(button.dataset.add, button);

    this.widgets = new Map(); // id -> виджет (порядок вставки = порядок на странице)
    this._hintTimer = null;
    this._flashTimer = null;
  }

  init() {
    if (!isStorageAvailable()) {
      this.showHint(
        'Браузер не разрешает сохранение данных: панель работает, но после обновления страницы изменения пропадут.',
        'warn',
        10000
      );
    }

    if (!this.restore()) this.loadDemo();
    this.sync();
  }

  hasType(type) {
    for (const widget of this.widgets.values()) {
      if (widget.type === type) return true;
    }
    return false;
  }

  addWidget(type, { id, collapsed = false, state, silent = false } = {}) {
    const config = WIDGET_TYPES[type];
    if (!config) {
      this.showHint('Неизвестный тип виджета', 'error');
      return null;
    }

    // Один тип — одна карточка
    if (this.hasType(type)) {
      const existing = [...this.widgets.values()].find((w) => w.type === type);
      this.showHint(
        `Виджет «${config.label}» уже на панели. Каждый тип можно добавить только один раз.`,
        'warn',
        6000
      );
      this.flash(existing);
      return null;
    }

    let widget = null;
    try {
      const safeId = typeof id === 'string' && SAFE_ID.test(id) && !this.widgets.has(id) ? id : uid(type);
      widget = new config.Class(safeId, { collapsed, state });
      widget.onRemove = (w) => this.removeWidget(w.id);
      widget.onChange = () => this.save();
      this.board.append(widget.render());
    } catch (err) {
      console.error(`Не удалось создать виджет «${config.label}»:`, err);
      widget?.destroy();
      this.showHint(`Не удалось добавить виджет «${config.label}»`, 'error');
      return null;
    }

    this.widgets.set(widget.id, widget);
    this.sync();

    if (!silent) {
      this.save();
      this.showHint(`Добавлен виджет «${config.label}»`, 'ok', 3500);
      widget.element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return widget;
  }

  removeWidget(id) {
    const widget = this.widgets.get(id);
    if (!widget) return false;

    const { title, type } = widget;

    widget.destroy(); // снимает обработчики, таймеры, запросы и удаляет карточку
    this.widgets.delete(id);

    this.sync();
    this.save();
    this.showHint(`Виджет «${title}» удалён`, 'ok', 3500);

    // Возвращаем фокус на кнопку добавления этого типа
    this.buttons.get(type)?.focus();
    return true;
  }

  /* ---------- Сохранение и восстановление ---------- */

  save() {
    saveState({
      version: 1,
      widgets: [...this.widgets.values()].map((widget) => widget.serialize())
    });
  }

  restore() {
    const saved = loadState();
    if (!saved || !Array.isArray(saved.widgets)) return false;

    for (const item of saved.widgets) {
      if (!item || typeof item !== 'object') continue;
      this.addWidget(item.type, {
        id: item.id,
        collapsed: item.collapsed === true,
        state: item.state,
        silent: true
      });
    }
    return true;
  }

  loadDemo() {
    this.addWidget('todo', { silent: true, state: { tasks: DEMO_TASKS } });
    this.addWidget('artist', { silent: true });
    this.addWidget('about', { silent: true });
    this.save();
  }

  /* ---------- Интерфейс ---------- */

  sync() {
    for (const [type, button] of this.buttons) {
      const added = this.hasType(type);
      button.classList.toggle('is-added', added);
      button.setAttribute('aria-disabled', String(added));
      button.title = added ? 'Этот виджет уже на панели' : '';
    }
    this.emptyState.hidden = this.widgets.size > 0;
  }

  showHint(message, tone = 'info', duration = 5000) {
    clearTimeout(this._hintTimer);
    this.hintEl.className = `hint hint--${tone}`;
    this.hintEl.textContent = message;

    this._hintTimer = setTimeout(() => {
      this.hintEl.textContent = '';
      this.hintEl.className = 'hint';
    }, duration);
  }

  flash(widget) {
    const node = widget?.element;
    if (!node) return;

    clearTimeout(this._flashTimer);
    node.classList.add('is-flash');
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this._flashTimer = setTimeout(() => node.classList.remove('is-flash'), 1400);
  }
}