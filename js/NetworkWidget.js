import { UIComponent } from './UIComponent.js';
import { ApiError } from './api.js';
import { el, icon, cleanText } from './dom.js';

/**
 * Общая логика сетевых карточек: поиск, загрузка, результат или ошибка с кнопкой «Повторить».
 * Подклассы реализуют fetchData(query, signal) и renderData(data).
 */
export class NetworkWidget extends UIComponent {
  static defaultQuery = '';
  static searchLabel = 'Запрос';
  static placeholder = '';

  constructor(id, title, { collapsed = false, query = '' } = {}) {
    super(id, title, { collapsed });
    this.query = cleanText(query, 80) || this.constructor.defaultQuery;
    this._requestAbort = null;
    this._requestId = 0;
  }

  fetchData() {
    throw new Error('fetchData() не реализован');
  }

  renderData() {
    throw new Error('renderData() не реализован');
  }

  /** Вызывается перед сменой содержимого области результата. */
  beforeViewChange() {}

  renderBody(body) {
    const inputId = `${this.id}-query`;

    this.input = el('input', {
      class: 'input',
      id: inputId,
      type: 'text',
      name: 'query',
      value: this.query,
      placeholder: this.constructor.placeholder,
      maxLength: 80,
      autocomplete: 'off',
      enterKeyHint: 'search'
    });

    this.fieldError = el('p', { class: 'field-error', attrs: { role: 'alert' } });

    const form = el('form', { class: 'search', attrs: { novalidate: '' } },
      el('label', { class: 'sr-only', htmlFor: inputId, text: this.constructor.searchLabel }),
      this.input,
      el('button', { class: 'btn btn--primary', type: 'submit', text: 'Найти' })
    );

    this.view = el('div', { class: 'view', attrs: { 'aria-live': 'polite', 'aria-busy': 'false' } });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = cleanText(this.input.value, 80);
      if (!value) {
        this.fieldError.textContent = 'Введите запрос';
        this.input.focus();
        return;
      }
      this.query = value;
      this.input.value = value;
      this.emitChange();
      this.load();
    }, { signal: this.signal });

    this.input.addEventListener('input', () => {
      this.fieldError.textContent = '';
    }, { signal: this.signal });

    body.append(form, this.fieldError, this.view);
    this.load();
  }

  async load() {
    this._requestAbort?.abort(); // новый запрос отменяет предыдущий
    const controller = new AbortController();
    this._requestAbort = controller;
    const requestId = ++this._requestId;

    this.setLoading();

    try {
      const data = await this.fetchData(this.query, controller.signal);
      if (this._destroyed || requestId !== this._requestId) return;
      this.setSuccess(data);
    } catch (err) {
      if (this._destroyed || requestId !== this._requestId || err?.name === 'AbortError') return;
      this.setError(err);
    } finally {
      if (this._requestAbort === controller) this._requestAbort = null;
    }
  }

  setLoading() {
    this.beforeViewChange();
    this.view.setAttribute('aria-busy', 'true');
    this.view.replaceChildren(
      el('div', { class: 'state' },
        el('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } }),
        el('span', { text: 'Загрузка…' })
      )
    );
  }

  setSuccess(data) {
    this.beforeViewChange();
    this.view.setAttribute('aria-busy', 'false');
    try {
      this.view.replaceChildren(this.renderData(data));
    } catch (err) {
      console.error(err);
      this.setError(new ApiError('Не удалось показать полученные данные', { kind: 'format' }));
    }
  }

  setError(err) {
    this.beforeViewChange();
    this.view.setAttribute('aria-busy', 'false');

    const message = err instanceof ApiError ? err.message : 'Произошла непредвиденная ошибка';

    const retry = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' },
      icon('retry'), 'Повторить'
    );
    retry.addEventListener('click', () => this.load(), { signal: this.signal });

    this.view.replaceChildren(
      el('div', { class: 'state state--error', attrs: { role: 'alert' } },
        el('p', { class: 'state__msg', text: message }),
        retry
      )
    );
  }

  getState() {
    return { query: this.query };
  }

  onDestroy() {
    this._requestAbort?.abort();
    this._requestAbort = null;
    super.onDestroy();
  }
}