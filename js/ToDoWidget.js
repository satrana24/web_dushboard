import { UIComponent } from './UIComponent.js';
import { el, icon, uid, cleanText, SAFE_ID } from './dom.js';

const MAX_LENGTH = 120;
const MAX_TASKS = 50;

function sanitizeTasks(raw) {
  if (!Array.isArray(raw)) return [];

  const seen = new Set();
  const result = [];

  for (const item of raw) {
    const text = cleanText(item?.text, MAX_LENGTH);
    if (!text) continue;

    let id = typeof item.id === 'string' && SAFE_ID.test(item.id) ? item.id : uid('t');
    if (seen.has(id)) id = uid('t');
    seen.add(id);

    result.push({ id, text, done: item.done === true });
    if (result.length >= MAX_TASKS) break;
  }
  return result;
}

export class ToDoWidget extends UIComponent {
  static type = 'todo';

  constructor(id, { collapsed = false, state } = {}) {
    super(id, 'Список дел', { collapsed });
    this.tasks = sanitizeTasks(state?.tasks); // задачи хранятся в свойстве экземпляра
  }

  renderBody(body) {
    const inputId = `${this.id}-new-task`;

    this.input = el('input', {
      class: 'input',
      id: inputId,
      type: 'text',
      name: 'task',
      placeholder: 'Что нужно сделать?',
      maxLength: MAX_LENGTH,
      autocomplete: 'off',
      enterKeyHint: 'done'
    });

    this.addBtn = el('button', { class: 'btn btn--primary', type: 'submit', text: 'Добавить' });

    this.form = el('form', { class: 'search', attrs: { novalidate: '' } },
      el('label', { class: 'sr-only', htmlFor: inputId, text: 'Новая задача' }),
      this.input,
      this.addBtn
    );

    this.error = el('p', { class: 'field-error', attrs: { role: 'alert' } });
    this.meta = el('p', { class: 'todo__meta' });
    this.list = el('ul', { class: 'tasks' });
    this.empty = el('p', { class: 'note todo__empty', text: 'Задач пока нет. Добавьте первую.' });

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.addTask(this.input.value);
    }, { signal: this.signal });

    this.input.addEventListener('input', () => {
      this.error.textContent = '';
    }, { signal: this.signal });

    // Делегирование: один обработчик на весь список
    this.list.addEventListener('change', (event) => {
      if (!event.target.matches('.task__check')) return;
      const item = event.target.closest('li[data-task-id]');
      if (item) this.toggleTask(item, event.target.checked);
    }, { signal: this.signal });

    this.list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="delete"]');
      const item = button?.closest('li[data-task-id]');
      if (item) this.removeTask(item);
    }, { signal: this.signal });

    body.append(this.form, this.error, this.meta, this.list, this.empty);
    this.tasks.forEach((task) => this.list.append(this.renderTask(task)));
    this.updateMeta();
  }

  renderTask(task) {
    const checkId = `${this.id}-check-${task.id}`;

    return el('li', { class: `task${task.done ? ' is-done' : ''}`, dataset: { taskId: task.id } },
      el('input', { class: 'task__check', type: 'checkbox', id: checkId, checked: task.done }),
      el('label', { class: 'task__text', htmlFor: checkId, text: task.text }), // только textContent
      el('button', {
        class: 'icon-btn icon-btn--danger',
        type: 'button',
        dataset: { action: 'delete' },
        attrs: { 'aria-label': `Удалить задачу: ${task.text}` }
      }, icon('trash'))
    );
  }

  addTask(rawText) {
    const text = cleanText(rawText, MAX_LENGTH);

    if (!text) {
      this.error.textContent = 'Введите текст задачи';
      this.input.value = '';
      this.input.focus();
      return false;
    }
    if (this.tasks.length >= MAX_TASKS) {
      this.error.textContent = `Достигнут предел: ${MAX_TASKS} задач. Удалите ненужные`;
      return false;
    }

    const task = { id: uid('t'), text, done: false };
    this.tasks.push(task);
    this.list.append(this.renderTask(task));

    this.input.value = '';
    this.error.textContent = '';
    this.input.focus();

    this.updateMeta();
    this.emitChange();
    return true;
  }

  toggleTask(item, done) {
    const task = this.tasks.find((t) => t.id === item.dataset.taskId);
    if (!task) return;

    task.done = done;
    item.classList.toggle('is-done', done);
    this.updateMeta();
    this.emitChange();
  }

  removeTask(item) {
    const neighbour = item.nextElementSibling || item.previousElementSibling;

    this.tasks = this.tasks.filter((t) => t.id !== item.dataset.taskId);
    item.remove();

    this.updateMeta();
    this.emitChange();

    // Не теряем фокус после удаления
    const next = neighbour?.querySelector('[data-action="delete"]') ?? this.addBtn;
    next?.focus();
  }

  updateMeta() {
    const done = this.tasks.filter((t) => t.done).length;
    this.meta.textContent = this.tasks.length ? `Выполнено: ${done} из ${this.tasks.length}` : '';
    this.empty.hidden = this.tasks.length > 0;
  }

  getState() {
    return { tasks: this.tasks.map((t) => ({ ...t })) };
  }
}