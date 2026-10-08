import type {
    SiteConfig,
    ProfileConfig,
    LicenseConfig,
} from "./types/config"
import type { FriendLink } from "./types/friend"
import type { I18nConfig } from "./types/i18n"

export const siteConfig: SiteConfig = {
    title: "Momo", // Title of the site, used in the tab in the browser and in SEO
    subTitle: "Blog", // Subtitle of the site
    rootSiteUrl: "https://momo.motues.top", // Root URL of the site, used for generating absolute URLs for SEO and social sharing

    favicon: "/favicon/favicon.ico", // Path of the favicon, relative to the /public directory

    pageSize: 6, // Number of posts per page
    toc: {
        enable: true,
        depth: 3 // Max depth of the table of contents, between 1 and 4
    },
    blogNavi: {
        enable: true // Whether to enable blog navigation in the blog footer
    },
    comments: {
        enable: true, // Whether to enable comments
        platform: "default", // Comment platform, set "default" to use Momo-backend, also supports "twikoo"
        backendUrl: "https://api-momo.motues.top" // Backend URL for comments
    },
    theme: {
        AOS: true, // Whether to enable AOS (Animate On Scroll) for animations
        LQIP: true, // Whether to enable LQIP (Low-Quality Image Placeholder) for image placeholders
        PhotoSwipe: true, // Whether to enable PhotoSwipe for image viewer
        imageCollage: {
            enable: true, // Whether to automatically arrange consecutive images into a grid (collage)
            maxColumns: 4 // Max images per row in a collage (2 - 6); the actual number is chosen automatically
        },
        postCard: {
            imageMode: "top" // Cover image mode for article cards: "top" shows the image above the content; "background" uses the image as the card background, fading to transparent from right to left
        },
        photoCover: {
            enable: false, // Whether to use a full-screen photo as the background of the home page; the title and subtitle are centered, and everything smoothly returns to the normal style as you scroll down
            image: "/cover.jpg", // Photo path: relative to the /public directory if it starts with '/', otherwise relative to the /src directory (e.g. assets/cover.jpg). The blurred placeholder is generated at build time, so there is no small image to prepare by hand
            mask: 0.5 // Opacity (0 - 1) of the black mask over the photo, fading away as you scroll down
        },
        overlayScrollbars: {
            enable: true, // Whether to replace the browser's default scrollbar with OverlayScrollbars (overlay style, can auto-hide)
            autoHide: "leave", // When to hide the scrollbar: "never" always visible; "scroll" hidden unless scrolling; "move" hidden unless the pointer moves over the page or the user scrolls; "leave" hidden when the pointer leaves the page or the user isn't scrolling
            size: 8 // Scrollbar thickness in pixels
        }
    },
    expressiveCode: {
        enable: true, // Whether to enable Expressive Code for code blocks; when false, code blocks fall back to plain text without highlighting (same in the CMS preview)
        theme: "one-dark-pro" // Shiki theme of code blocks, e.g. "one-dark-pro", "github-dark", "vitesse-dark"; one theme is used for both light and dark mode
    }
}

export const profileConfig: ProfileConfig = {
    avatar: "assets/Motues.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
    name: "Motues", // Used in the footer of the blog
    description: "Life is colorful!", // Used in SEO
    indexPage: "https://www.motues.top", // The homepage, used in footer and SEO
    startYear: 2024, // The year the site was created, used in the footer
}

export const licenseConfig: LicenseConfig = {
	enable: true, // Whether to enable license information
	name: "CC BY-NC-SA 4.0", // License name
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/", // License URL
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
        name: 'Motues', // Name of the friend link
        avatar: 'https://www.motues.top/avatar.jpg', // Avatar image of the friend link
        url: 'https://www.motues.top', // URL of the friend link
        description: 'Like River!' // Description of the friend link, set to an empty string if not needed
    },
    {
        name: 'Astro',
        avatar: 'https://avatars.githubusercontent.com/u/44914786',
        url: 'https://astro.build',
        description: 'Build fast websites, faster.'
    }
    // Add more friend links here
]