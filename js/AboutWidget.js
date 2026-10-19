import { NetworkWidget } from './NetworkWidget.js';
import { fetchArtistInfo } from './api.js';
import { el, isHttps } from './dom.js';


export class AboutWidget extends NetworkWidget {
  static type = 'about';
  static defaultQuery = 'Земфира';

  constructor(id, { collapsed = false, state } = {}) {
    super(id, 'Об артисте', {
      collapsed,
      query: state?.query || ''
    });
  }

  fetchData(query, signal) {
    return fetchArtistInfo(query, { signal });
  }

  renderBody(body) {
    // Поле ввода и кнопка поиска больше не создаются.
    this.view = el('div', {
      class: 'view',
      attrs: {
        'aria-live': 'polite',
        'aria-busy': 'false'
      }
    });

    // Слушаем смену исполнителя в соседнем виджете.
    window.addEventListener(
      'artist-changed',
      (event) => {
        const artist = event.detail?.artist;
        if (!artist || artist === this.query) return;

        this.query = artist;
        this.emitChange();
        this.load();
      },
      { signal: this.signal }
    );

    body.append(this.view);

    // При первом открытии используем текущего исполнителя,
    // если он уже выбран, иначе — исполнителя по умолчанию.
    const currentArtist = document.querySelector(
        '.card--artist .artist__name'
    );

    if (currentArtist?.textContent?.trim()) {
      this.query = currentArtist.textContent.trim();
    }

    this.load();
  }

  renderData(data) {
    let photo = null;

    if (isHttps(data.thumbnail)) {
      photo = el('img', {
        class: 'about__photo',
        attrs: {
          alt: `Фото: ${data.title}`,
          loading: 'lazy'
        }
      });

      photo.src = data.thumbnail;

      photo.addEventListener(
        'error',
        () => photo.classList.add('is-broken'),
        { signal: this.signal }
      );
    }

    const link = isHttps(data.url)
      ? el('a', {
          class: 'about__link',
          href: data.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          text: 'Читать в Википедии →'
        })
      : null;

    return el(
      'div',
      { class: `about${photo ? '' : ' about--no-photo'}` },
      photo,
      el(
        'div',
        { class: 'about__text' },
        el('h3', {
          class: 'about__title',
          text: data.title
        }),
        data.description
          ? el('p', {
              class: 'about__desc',
              text: data.description
            })
          : null,
        el('p', {
          class: 'about__extract',
          text: data.extract
        }),
        link
      )
    );
  }
}
