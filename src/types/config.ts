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
        imageCollage: {
            enable: boolean;
            maxColumns: number;
        };
        postCard: {
            imageMode: "top" | "background"; 
        };
        photoCover: {
            enable: boolean;
            image: string;
            mask: number;
        };
        overlayScrollbars: {
            enable: boolean;
            autoHide: "never" | "scroll" | "move" | "leave";
            size: number;
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