import { NetworkWidget } from './NetworkWidget.js';
import { fetchArtistTracks } from './api.js';
import { el, icon, isHttps } from './dom.js';

// Одновременно играет только одно превью на всей панели
let activeAudio = null;

const RANDOM_ARTISTS = [
  'Земфира',
  'Кино',
  'Мумий Тролль',
  'Сплин',
  'Би-2',
  'Алиса',
  'Король и Шут',
  'Мельница',
  'Radiohead',
  'The Beatles',
  'Queen',
  'Nirvana',
  'Coldplay',
  'Muse',
  'Linkin Park',
  'Arctic Monkeys',
  'The Weeknd',
  'Taylor Swift',
  'Adele',
  'Lana Del Rey',
  'Daft Punk',
  'ABBA',
  'David Bowie',
  'Michael Jackson'
];

export class ArtistWidget extends NetworkWidget {
  static type = 'artist';
  static defaultQuery = 'Zemfira';
  static searchLabel = 'Имя исполнителя';
  static placeholder = 'Например: Radiohead';

  constructor(id, { collapsed = false, state } = {}) {
    super(id, 'Исполнитель', { collapsed, query: state?.query });
    this.tracks = [];
    this.list = null;
    this.note = null;
    this.audio = null;
    this.playingIndex = -1;
  }

  fetchData(query, signal) {
    return fetchArtistTracks(query, { signal });
  }

  renderBody(body) {
  super.renderBody(body);

  const randomButton = el('button', {
    class: 'btn btn--ghost',
    type: 'button',
    text: 'Случайный'
  });

  randomButton.addEventListener('click', () => {
    const options = RANDOM_ARTISTS.filter(
      (name) => name.toLowerCase() !== this.query.toLowerCase()
    );

    const artist = options[
      Math.floor(Math.random() * options.length)
    ];

    this.query = artist;

    if (this.input) {
      this.input.value = artist;
    }

    this.emitChange();
    this.load();
  }, { signal: this.signal });

  this.view.before(randomButton);
}

  renderData(data) {
  this.tracks = data.tracks;

  window.dispatchEvent(
    new CustomEvent('artist-changed', {
      detail: { artist: data.artist }
    })
  );

    const list = el('ul', { class: 'tracks' });
    data.tracks.forEach((track, index) => list.append(this.renderTrack(track, index)));

    list.addEventListener('click', (event) => {
      const button = event.target.closest('.play-btn');
      if (button && !button.disabled) this.togglePreview(Number(button.dataset.index));
    }, { signal: this.signal });

    this.list = list;
    this.note = el('p', { class: 'note', attrs: { role: 'status' } });

    return el('div', { class: 'artist' },
      el('div', { class: 'artist__head' },
        el('p', { class: 'artist__name', text: data.artist }),
        data.genre ? el('span', { class: 'badge', text: data.genre }) : null
      ),
      list,
      this.note,
      el('p', { class: 'note', text: 'Превью по 30 секунд · iTunes Search API' })
    );
  }

  renderTrack(track, index) {
    const cover = el('img', { class: 'track__cover', attrs: { alt: '', width: '48', height: '48', loading: 'lazy' } });
    if (isHttps(track.cover)) cover.src = track.cover;
    cover.addEventListener('error', () => cover.classList.add('is-broken'), { signal: this.signal });

    const hasPreview = isHttps(track.preview);
    const button = el('button', {
      class: 'play-btn',
      type: 'button',
      disabled: !hasPreview,
      title: hasPreview ? '' : 'Превью недоступно',
      dataset: { index },
      attrs: { 'aria-label': `Прослушать превью: ${track.name}` }
    }, icon('play'));

    return el('li', { class: 'track' },
      cover,
      el('div', { class: 'track__info' },
        el('p', { class: 'track__name', text: track.name }),
        el('p', { class: 'track__meta', text: track.album })
      ),
      button
    );
  }

  ensureAudio() {
    if (this.audio) return this.audio;

    const audio = new Audio();
    audio.preload = 'none';

    const sync = () => this.syncButtons();
    for (const name of ['play', 'pause', 'ended']) {
      audio.addEventListener(name, sync, { signal: this.signal });
    }
    audio.addEventListener('error', () => {
      if (!audio.getAttribute('src')) return;
      this.showNote('Не удалось загрузить превью. Попробуйте другой трек.');
      this.syncButtons();
    }, { signal: this.signal });

    this.audio = audio;
    return audio;
  }

  togglePreview(index) {
    const track = this.tracks[index];
    if (!track || !isHttps(track.preview)) return;

    const audio = this.ensureAudio();
    this.showNote('');

    if (this.playingIndex === index && !audio.paused) {
      audio.pause();
      return;
    }

    if (activeAudio && activeAudio !== audio) activeAudio.pause();

    if (this.playingIndex !== index) {
      this.playingIndex = index;
      audio.src = track.preview;
    }
    activeAudio = audio;

    audio.play().catch((err) => {
      if (err?.name === 'AbortError') return;
      this.showNote('Не удалось воспроизвести превью. Попробуйте ещё раз.');
      this.syncButtons();
    });
  }

  syncButtons() {
    if (!this.list || !this.audio) return;

    const playing = !this.audio.paused && !this.audio.ended;

    this.list.querySelectorAll('.track').forEach((item, index) => {
      const isCurrent = playing && index === this.playingIndex;
      const button = item.querySelector('.play-btn');

      item.classList.toggle('is-playing', isCurrent);
      button.replaceChildren(icon(isCurrent ? 'pause' : 'play'));
      button.setAttribute(
        'aria-label',
        `${isCurrent ? 'Остановить' : 'Прослушать'} превью: ${this.tracks[index]?.name ?? ''}`
      );
    });
  }

  showNote(text) {
    if (this.note) this.note.textContent = text;
  }

  beforeViewChange() {
    this.audio?.pause();
    this.playingIndex = -1;
    this.list = null;
    this.note = null;
  }

  onDestroy() {
    super.onDestroy();

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      if (activeAudio === this.audio) activeAudio = null;
      this.audio = null;
    }
    this.tracks = [];
    this.list = null;
    this.note = null;
  }
}