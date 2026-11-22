export type SiteConfig = {
    title: string;
    subTitle: string;
    /**
     * 站点描述：meta description / og:description 的兜底文案。
     * 可以是单个字符串（所有语言共用），也可以按语言给（`{ "zh-cn": "...", en: "..." }`）。
     * 不填则回退个人信息里的简介。
     */
    description?: string | Record<string, string>;
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
        /** 文章页顶部的阅读进度条（2px 细线 + 剩余时间） */
        readingProgress: boolean;
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