import { h } from 'hastscript';
import type { Element, ElementContent, Properties } from 'hast';

/** 网易云音乐卡片（::music{id="songId"}），数据由卡片内的脚本异步获取 */
export function MusicCardComponent(
  properties: Properties,
  children: ElementContent[],
): Element {
  if (Array.isArray(children) && children.length !== 0) {
    return h('div', { class: 'hidden' }, [
      'Invalid directive. ("music" directive must be leaf type "::music{id="songId"}")',
    ]);
  }

  const songId = typeof properties.id === 'string' ? properties.id : '';
  if (!songId) {
    return h('div', { class: 'hidden' }, [
      'Invalid song id. ("id" attribute must be provided)',
    ]);
  }

  const cardUuid = `MC${Math.random().toString(36).slice(-6)}`;

  const nCover = h(`div#${cardUuid}-cover`, { class: 'music-cover' });
  const nTitle = h(`div#${cardUuid}-title`, { class: 'music-title' }, 'Waiting for API...');
  const nArtist = h(`div#${cardUuid}-artist`, { class: 'music-artist' }, 'Waiting...');

  const nScript = h(
    `script#${cardUuid}-script`,
    { type: 'text/javascript' },
    `
        (function() {
            const initMusicCard = () => {
                const card = document.getElementById('${cardUuid}-card');
                // 卡片不存在或已加载过就跳过（astro:page-load 会重复触发）
                if (!card || card.dataset.loaded === "true") return;

                fetch('https://open.motues.top/music?server=netease&type=details&id=${songId}', { referrerPolicy: "no-referrer" })
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.id) {
                            const titleEl = document.getElementById('${cardUuid}-title');
                            if (titleEl) titleEl.innerText = data.name || "未知曲目";

                            const artistEl = document.getElementById('${cardUuid}-artist');
                            const artistName = Array.isArray(data.artist) ? data.artist.join(', ') : (data.artist || '未知艺术家');
                            if (artistEl) artistEl.innerText = artistName;

                            const coverEl = document.getElementById('${cardUuid}-cover');
                            if (coverEl) {
                                fetch('https://open.motues.top/music?server=netease&type=cover&id=${songId}', { referrerPolicy: "no-referrer" })
                                    .then(res => res.json())
                                    .then(coverData => {
                                        if (coverData && coverData.url) {
                                            coverEl.style.backgroundImage = 'url(' + coverData.url + ')';
                                            coverEl.style.backgroundColor = 'transparent';
                                        }
                                    })
                                    .catch(err => {
                                        console.warn("[MUSIC-CARD] Error loading cover:", err);
                                    });
                            }

                            card.classList.remove("fetch-waiting");
                            card.dataset.loaded = "true";
                            console.log("[MUSIC-CARD] Loaded: ${songId}");
                        }
                    })
                    .catch(err => {
                        const cardEl = document.getElementById('${cardUuid}-card');
                        cardEl?.classList.add("fetch-error");
                        console.warn("[MUSIC-CARD] Error loading ${songId}:", err);
                    });
            };

            initMusicCard();
            document.addEventListener('astro:page-load', initMusicCard);
        })();
        `,
  );

  return h(
    `a#${cardUuid}-card`,
    {
      class: 'card-music fetch-waiting no-styling',
      'data-song-id': songId,
      href: `https://music.163.com/#/song?id=${songId}`,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    [
      h('div', { class: 'music-card' }, [
        h('div', { class: 'music-cover-wrapper', id: `${cardUuid}-cover-wrapper` }, [nCover]),
        h('div', { class: 'music-info' }, [h('div', { class: 'music-header' }, [nTitle, nArtist])]),
      ]),
      nScript,
    ],
  );
}
