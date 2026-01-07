import type {
    SiteConfig,
    ProfileConfig,
    LicenseConfig
} from "./types/config"

import type { FriendLink } from "./types/friend"

export const siteConfig: SiteConfig = {
    title: "Momo",
    subTitle: "Blog",

    favicon: "/favicon/favicon.ico", // Path of the favicon, relative to the /public directory

    pageSize: 6, // Number of posts per page
    toc: {
        enable: true,
        depth: 3 // Max depth of the table of contents, between 1 and 4
    },
    comments: {
        enable: true,
        backendUrl: "https://api-momo.motues.top"
    }

  }

export const profileConfig: ProfileConfig = {
    avatar: "assets/Motues.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
    name: "Momo",
    description: "Life is colorful!",
    indexPage: "https://motues.top",
}

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const friendLinkConfig: FriendLink[] = [
  {
    name: 'Motues',
    avatar: 'https://avatars.githubusercontent.com/u/164032838',
    url: 'https://motues.top',
    description: 'Like River!'
  },
  {
    name: 'Astro',
    avatar: 'https://avatars.githubusercontent.com/u/44914786',
    url: 'https://astro.build',
    description: 'Build fast websites, faster.'
  }
  // Add more friend links here
]