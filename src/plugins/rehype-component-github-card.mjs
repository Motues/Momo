/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * Creates a GitHub Card component.
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.repo - The GitHub repository in the format "owner/repo".
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created GitHub Card component.
 */
export function GithubCardComponent(properties, children) {
    if (Array.isArray(children) && children.length !== 0)
        return h("div", { class: "hidden" }, [
            'Invalid directive. ("github" directive must be leaf type "::github{repo="owner/repo"}")',
        ]);

    if (!properties.repo || !properties.repo.includes("/"))
        return h(
            "div",
            { class: "hidden" },
            'Invalid repository. ("repo" attribute must be in the format "owner/repo")',
        );

    const repo = properties.repo;
    const cardUuid = `GC${Math.random().toString(36).slice(-6)}`;

    // 预定义各部分节点
    const nAvatar = h(`div#${cardUuid}-avatar`, { class: "gc-avatar" });
    const nLanguage = h(`span#${cardUuid}-language`, { class: "gc-language" }, "Waiting...");
    const nDescription = h(`div#${cardUuid}-description`, { class: "gc-description" }, "Waiting for api.github.com...");
    const nStars = h(`div#${cardUuid}-stars`, { class: "gc-stars" }, "00K");
    const nForks = h(`div#${cardUuid}-forks`, { class: "gc-forks" }, "0K");
    const nLicense = h(`div#${cardUuid}-license`, { class: "gc-license" }, "0K");

    const nTitle = h("div", { class: "gc-titlebar" }, [
        h("div", { class: "gc-titlebar-left" }, [
            h("div", { class: "gc-owner" }, [
                nAvatar,
                h("div", { class: "gc-user" }, repo.split("/")[0]),
            ]),
            h("div", { class: "gc-divider" }, "/"),
            h("div", { class: "gc-repo" }, repo.split("/")[1]),
        ]),
        h("div", { class: "github-logo" }),
    ]);

    const nScript = h(
        `script#${cardUuid}-script`,
        { type: "text/javascript" },
        `
        (function() {
            const fetchCardData = () => {
                const card = document.getElementById('${cardUuid}-card');
                // 如果找不到卡片，或者卡片已经加载过数据，则跳过
                if (!card || card.dataset.loaded === "true") return;

                fetch('https://api.github.com/repos/${repo}', { referrerPolicy: "no-referrer" })
                    .then(response => response.json())
                    .then(data => {
                        if (data.message === "Not Found") throw new Error("Repo not found");
                        
                        document.getElementById('${cardUuid}-description').innerText = data.description?.replace(/:[a-zA-Z0-9_]+:/g, '') || "Description not set";
                        document.getElementById('${cardUuid}-language').innerText = data.language || "Unknown";
                        
                        const fmt = Intl.NumberFormat('en-us', { notation: "compact", maximumFractionDigits: 1 });
                        document.getElementById('${cardUuid}-forks').innerText = fmt.format(data.forks).replaceAll("\u202f", '');
                        document.getElementById('${cardUuid}-stars').innerText = fmt.format(data.stargazers_count).replaceAll("\u202f", '');
                        document.getElementById('${cardUuid}-license').innerText = data.license?.spdx_id || "No License";

                        const avatarEl = document.getElementById('${cardUuid}-avatar');
                        avatarEl.style.backgroundImage = 'url(' + data.owner.avatar_url + ')';
                        avatarEl.style.backgroundColor = 'transparent';

                        card.classList.remove("fetch-waiting");
                        card.dataset.loaded = "true"; // 标记加载完成
                        console.log("[GITHUB-CARD] Successfully loaded: ${repo}");
                    })
                    .catch(err => {
                        const c = document.getElementById('${cardUuid}-card');
                        c?.classList.add("fetch-error");
                        console.warn("[GITHUB-CARD] Error loading ${repo}:", err);
                    });
            };

            fetchCardData();
            document.addEventListener('astro:page-load', fetchCardData);
        })();
        `
    );

    return h(
        `a#${cardUuid}-card`,
        {
            class: "card-github fetch-waiting no-styling",
            href: `https://github.com/${repo}`,
            target: "_blank",
            "data-repo": repo,
        },
        [
            nTitle,
            nDescription,
            h("div", { class: "gc-infobar" }, [nStars, nForks, nLicense, nLanguage]),
            nScript,
        ],
    );
}