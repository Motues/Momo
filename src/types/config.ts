export type SiteConfig = {
    title: string;
    subTitle: string;
    rootSiteUrl?: string;

    favicon: string;

    pageSize: number;
    toc: {
        enable: boolean;
        depth: number;
    };
    blogNavi: {
        enable: boolean;
    };
    comments: {
        enable: boolean;
        platform: string;
        backendUrl: string;
    };
    theme: {
        AOS: boolean;
        LQIP: boolean;
        PhotoSwipe: boolean;
        postCard: {
            imageMode: "top" | "background"; 
        };
    };
    expressiveCode: {
        enable: boolean;
        theme: string;
    };
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