export type SiteConfig = {
    title: string;
    subTitle: string;

    cover: {
        enabled: boolean;
        title: string;
        subTitle: string;
    };

    favicon: string;

    pageSize: number;
    toc: {
        enabled: boolean;
        depth: number;
    }
}

export type ProfileConfig = {
    avatar: string;
    name: string;
    description: string;
    indexPage?: string;
    links?: {
        name: string;
        url: string;
        icon: string;
        color: string;
    }[];
}

export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};