export type SiteConfig = {
    title: string;
    subTitle: string;

    favicon: string;

    pageSize: number;
    toc: {
        enable: boolean;
        depth: number;
    };
    blogNavi: {
        enable: boolean;
    }
    comments: {
        enable: boolean;
        backendUrl: string;
    }
}

export type ProfileConfig = {
    avatar: string;
    name: string;
    description: string;
    indexPage?: string;
    startYear: number;
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