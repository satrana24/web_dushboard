const KEY = 'music-dashboard:v1';

// Все операции с localStorage обёрнуты в try/catch: хранилище может быть
// заблокировано (приватный режим, запрет в настройках, переполнение).

export function isStorageAvailable() {
  try {
    const probe = '__probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}