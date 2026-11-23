import type {
    SiteConfig,
    ProfileConfig,
    LicenseConfig,
} from "./types/config"
import type { FriendLink } from "./types/friend"
import type { I18nConfig } from "./types/i18n"

export const siteConfig: SiteConfig = {
    title: "Momo", // Site title, used in the browser tab and in SEO
    subTitle: "Blog",
    // Fallback meta description / og:description; a per-language map keeps English pages from inheriting the Chinese text.
    description: {
        "zh-cn": "Momo 是一个极简风格的 Astro 博客模板：中英双语、深色模式、站内搜索，支持 KaTeX / Typst 等丰富的 Markdown 语法。",
        en: "Momo is a minimalist Astro blog template with bilingual content, dark mode, built-in search and rich Markdown support such as KaTeX and Typst.",
    },
    rootSiteUrl: "https://momo.motues.top", // Root URL, used for absolute URLs in SEO and social sharing

    favicon: "/favicon/favicon.ico", // Favicon path, relative to the /public directory

    pageSize: 6, // Number of posts per page
    toc: {
        enable: true,
        depth: 3 // Max TOC depth (1 - 4)
    },
    blogNavi: {
        enable: true // Enable blog navigation in the article footer
    },
    comments: {
        enable: true,
        platform: "default", // Comment platform: "default" (Momo-backend) or "twikoo"
        backendUrl: "https://api-momo.motues.top" // Backend URL for comments
    },
    theme: {
        AOS: true, // Enable entrance animations (built in; key name kept for compatibility)
        LQIP: true, // Enable LQIP image placeholders
        PhotoSwipe: true, // Enable the image lightbox
        readingProgress: true, // Show the reading progress bar (2px) at the top of article pages
        imageCollage: {
            enable: true, // Merge consecutive images into a grid (collage)
            maxColumns: 4 // Max images per row in a collage (2 - 6); the actual number is chosen automatically
        },
        postCard: {
            imageMode: "top" // Cover mode of article cards: "top" = image above the content; "background" = image as the card background, fading out from right to left
        },
        photoCover: {
            enable: false, // Full-screen photo background on the home page; the title/subtitle return to the normal style on scroll
            image: "/cover.jpg", // Photo path: '/'-prefixed = /public, otherwise /src (e.g. assets/cover.jpg); the blurred placeholder is generated at build time
            mask: 0.5 // Black mask opacity over the photo (0 - 1), fading out on scroll
        },
        overlayScrollbars: {
            enable: true, // Replace the browser's scrollbar with OverlayScrollbars
            autoHide: "leave", // When to hide: "never"; "scroll" = unless scrolling; "move" = unless the pointer moves; "leave" = pointer leaves or idle
            size: 8 // Scrollbar thickness in pixels
        }
    },
    expressiveCode: {
        enable: true, // Enable Expressive Code; false falls back to plain code blocks (also in the CMS preview)
        theme: "one-dark-pro" // Shiki theme of code blocks, used for both light and dark mode
    }
}

export const profileConfig: ProfileConfig = {
    avatar: "assets/Motues.jpg", // Relative to /src; '/'-prefixed = /public
    name: "Motues", // Author name, used in the footer
    description: "Life is colorful!", // Used in SEO
    indexPage: "https://www.motues.top", // Homepage, used in the footer and SEO
    startYear: 2024, // Year the site was created, used in the footer
}

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const i18nConfig: I18nConfig = {
    defaultLanguage: "zh-cn", // Default language of the site
    supportedLanguages: ["zh-cn", "en"], // List of supported languages
    translations: { // Translation content for each supported language
        "zh-cn": {
            Cover: {
                title: {
                    home: "欢迎来到 Momo 的博客",
                    archive: "文章归档",
                    about: "关于",
                    friends: "友链",
                },
                subTitle: {
                    home: "生活多彩！",
                    archive: "共 {count} 篇文章", // {count} will be replaced with the total number of articles
                    about: "一个极简的Blog模板",
                    friends: "有趣的灵魂",
                }
            }
        },
        "en": {
            Cover: {
                title: {
                    home: "Welcome to Momo's Blog",
                    archive: "Archive",
                    about: "About",
                    friends: "Friends",
                },
                subTitle: {
                    home: "Life is colorful!",
                    archive: "Total of {count} articles",
                    about: "A minimalist blog template",
                    friends: "Interesting Souls",
                }
            }
        }
    }
};

export const friendLinkConfig: FriendLink[] = [
    {
        name: 'Motues',
        avatar: 'https://www.motues.top/avatar.jpg',
        url: 'https://www.motues.top',
        description: 'Like River!' // One-line description; empty string if not needed
    },
    {
        name: 'Astro',
        avatar: 'https://avatars.githubusercontent.com/u/44914786',
        url: 'https://astro.build',
        description: 'Build fast websites, faster.'
    }
]