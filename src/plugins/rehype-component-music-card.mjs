/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * Creates a NetEase Music Card.
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.id - The NetEase Music song ID.
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created NetEase Music Card component.
 */
export function MusicCardComponent(properties, children) {
    if (Array.isArray(children) && children.length !== 0)
        return h("div", { class: "hidden" }, [
            'Invalid directive. ("music" directive must be leaf type "::music{id="songId"}")',
        ]);

    if (!properties.id)
        return h(
            "div",
            { class: "hidden" },
            'Invalid song id. ("id" attribute must be provided)',
        );

    const songId = properties.id;
    const cardUuid = `MC${Math.random().toString(36).slice(-6)}`;

    const nCover = h(`div#${cardUuid}-cover`, { class: "music-cover" });
    const nTitle = h(`div#${cardUuid}-title`, { class: "music-title" }, "Waiting for API...");
    const nArtist = h(`div#${cardUuid}-artist`, { class: "music-artist" }, "Waiting...");

    const nScript = h(
        `script#${cardUuid}-script`,
        { type: "text/javascript" },
        `
        (function() {
            const initMusicCard = () => {
                const card = document.getElementById('${cardUuid}-card');
                // 幂等性检查：如果卡片不存在，或已经标记为加载完成，则不再执行
                if (!card || card.dataset.loaded === "true") return;

                fetch('https://163api.qijieya.cn/song/detail?ids=${songId}', { referrerPolicy: "no-referrer" })
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.songs && data.songs.length > 0) {
                            const song = data.songs[0];
                            
                            // 更新标题
                            const titleEl = document.getElementById('${cardUuid}-title');
                            if (titleEl) titleEl.innerText = song.name || "未知曲目";
                            
                            // 更新艺术家
                            const artistEl = document.getElementById('${cardUuid}-artist');
                            const artistName = song.ar ? song.ar.map(a => a.name).join(', ') : '未知艺术家';
                            if (artistEl) artistEl.innerText = artistName;
                            
                            // 更新封面
                            const coverEl = document.getElementById('${cardUuid}-cover');
                            if (coverEl && song.al && song.al.picUrl) {
                                coverEl.style.backgroundImage = 'url(' + song.al.picUrl + ')';
                                coverEl.style.backgroundColor = 'transparent';
                            }

                            // 移除等待状态并加锁
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
        `
    );

    return h(
        `a#${cardUuid}-card`,
        {
            class: "card-music fetch-waiting no-styling",
            "data-song-id": songId,
            href: `https://music.163.com/#/song?id=${songId}`, 
            target: "_blank", 
            rel: "noopener noreferrer" 
        },
        [
            h("div", { class: "music-card" }, [
                // 左侧封面图
                h("div", { class: "music-cover-wrapper", id: `${cardUuid}-cover-wrapper` }, [
                    nCover,
                ]),
                // 右侧信息区
                h("div", { class: "music-info" }, [
                    h("div", { class: "music-header" }, [
                        nTitle,
                        nArtist,
                    ]),
                ])
            ]),
            nScript,
        ],
    );
}