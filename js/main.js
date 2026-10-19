import { Dashboard } from './Dashboard.js';

const buttons = document.querySelectorAll('[data-add]');

const dashboard = new Dashboard({
  board: document.getElementById('board'),
  emptyState: document.getElementById('empty'),
  hint: document.getElementById('hint'),
  buttons
});

// Кнопки добавления виджетов
buttons.forEach((button) => {
  button.addEventListener('click', () => dashboard.addWidget(button.dataset.add));
});

dashboard.init();