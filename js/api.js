export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'network' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

function httpMessage(status) {
  if (status === 429) return 'Слишком много запросов. Подождите немного и повторите';
  if (status >= 500) return 'Сервис временно недоступен. Попробуйте позже';
  return `Сервис вернул ошибку (код ${status})`;
}

/** GET-запрос с таймаутом и внешней отменой. Бросает ApiError с понятным текстом. */
export async function fetchJson(url, { signal, timeout = 10000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new ApiError(httpMessage(response.status), { status: response.status, kind: 'http' });
    }
    return await response.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (timedOut) throw new ApiError('Сервис слишком долго не отвечает', { kind: 'timeout' });
    if (signal?.aborted) throw err; // отмена нашей стороной — не ошибка для пользователя
    if (err instanceof SyntaxError) {
      throw new ApiError('Сервис вернул данные в неожиданном формате', { kind: 'format' });
    }
    throw new ApiError('Не удалось связаться с сервисом. Проверьте интернет и повторите', { kind: 'network' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/* ---------- iTunes Search API: треки исполнителя ---------- */

async function searchItunes(name, signal, onlyArtist) {
  const params = new URLSearchParams({ term: name, media: 'music', entity: 'song', limit: '25' });
  if (onlyArtist) params.set('attribute', 'artistTerm');

  const data = await fetchJson(`https://itunes.apple.com/search?${params}`, { signal });
  if (!data || !Array.isArray(data.results)) {
    throw new ApiError('Сервис вернул данные в неожиданном формате', { kind: 'format' });
  }
  return data.results;
}

export async function fetchArtistTracks(name, { signal } = {}) {
  let results = await searchItunes(name, signal, true);
  // Для некоторых написаний поиск строго по имени артиста ничего не находит
  if (!results.length) results = await searchItunes(name, signal, false);

  const tracks = [];
  const seen = new Set();

  for (const item of results) {
    if (!item.trackName || !item.artistName) continue;
    const key = String(item.trackName).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    tracks.push({
      name: String(item.trackName),
      artist: String(item.artistName),
      album: item.collectionName ? String(item.collectionName) : '',
      genre: item.primaryGenreName ? String(item.primaryGenreName) : '',
      cover: item.artworkUrl100 || '',
      preview: item.previewUrl || ''
    });
    if (tracks.length === 6) break;
  }

  if (!tracks.length) {
    throw new ApiError(`Исполнитель «${name}» не найден. Проверьте написание`, { kind: 'not-found' });
  }
  return { artist: tracks[0].artist, genre: tracks[0].genre, tracks };
}

/* ---------- Википедия: краткая справка об артисте ---------- */

const WIKI_SUMMARY = 'https://ru.wikipedia.org/api/rest_v1/page/summary/';

function wikiSummary(title, signal) {
  return fetchJson(`${WIKI_SUMMARY}${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal });
}

async function findWikiTitle(name, signal) {
  const params = new URLSearchParams({
    action: 'opensearch', search: name, limit: '1', namespace: '0', format: 'json', origin: '*'
  });
  const data = await fetchJson(`https://ru.wikipedia.org/w/api.php?${params}`, { signal });
  return Array.isArray(data) && Array.isArray(data[1]) ? data[1][0] || null : null;
}

export async function fetchArtistInfo(name, { signal } = {}) {
  let data;

  try {
    data = await wikiSummary(name, signal);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    // Точной статьи нет — пробуем найти по поиску (другой регистр, опечатка)
    const title = await findWikiTitle(name, signal);
    if (!title) {
      throw new ApiError(`Статья про «${name}» не найдена`, { kind: 'not-found', status: 404 });
    }
    data = await wikiSummary(title, signal);
  }

  if (data.type === 'disambiguation') {
    throw new ApiError(
      `У запроса «${name}» несколько значений. Уточните его, например: «${name} (группа)»`,
      { kind: 'ambiguous' }
    );
  }
  if (!data.extract) {
    throw new ApiError(`Для «${name}» нет краткого описания`, { kind: 'not-found' });
  }

  return {
    title: data.title || name,
    description: data.description || '',
    extract: data.extract,
    thumbnail: data.thumbnail?.source || '',
    url: data.content_urls?.desktop?.page || ''
  };
}