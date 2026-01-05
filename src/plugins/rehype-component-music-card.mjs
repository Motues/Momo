/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * Creates a NetEase Music Card component.
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
	const cardUuid = `MC${Math.random().toString(36).slice(-6)}`; // Collisions are not important

	const nCover = h(`div#${cardUuid}-cover`, { class: "music-cover" });
	const nTitle = h(`div#${cardUuid}-title`, { class: "music-title" }, "Waiting for 163api.qijieya.cn...");
	const nArtist = h(`div#${cardUuid}-artist`, { class: "music-artist" }, "Waiting...");

	const nScript = h(
		`script#${cardUuid}-script`,
		{ type: "text/javascript", defer: true },
		`
			// 首先获取歌曲详细信息
			fetch('https://163api.qijieya.cn/song/detail?ids=${songId}', { referrerPolicy: "no-referrer" })
			.then(response => response.json())
			.then(data => {
				if (data && data.songs && data.songs.length > 0) {
					const song = data.songs[0];
					
					// Update title
					const titleEl = document.getElementById('${cardUuid}-title');
					titleEl.innerText = song.name || "${Array.isArray(children) && children.length > 0 ? children[0].value || '未知曲目' : '未知曲目'}";
					
					// Update artist
					const artistEl = document.getElementById('${cardUuid}-artist');
					const artistName = song.ar ? song.ar.map(artist => artist.name).join(', ') : '未知艺术家';
					artistEl.innerText = artistName;
					
					// Update cover
					const coverEl = document.getElementById('${cardUuid}-cover');
					if (song.al && song.al.picUrl) {
						coverEl.style.backgroundImage = 'url(' + song.al.picUrl + ')';
						coverEl.style.backgroundColor = 'transparent';
					}
				}
			})
			.catch(err => {
				const cardEl = document.getElementById('${cardUuid}-card');
				cardEl?.classList.add("fetch-error");
				console.warn("[MUSIC-CARD] (Error) Loading card for song ${songId} | ${cardUuid}.", err)
			});
		`,
	);

	return h(
		`a#${cardUuid}-card`,
		{
			class: "card-music fetch-waiting",
			songId,
			href: `https://music.163.com/#/song?id=${songId}`, target: "_blank", rel: "noopener noreferrer" 
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