import type { Translation } from "@i18n/key";

const translation: Translation = {
    header: {
        home: "首页",
        archive: "归档",
        about: "关于",
        friends: "友链",
    },
    cover: {
        title: {
            home: "欢迎来到Momo的博客",
            archive: "文章归档",
            about: "关于",
            friends: "友链",
            page404: "秘密",
        },
        subTitle: {
            home: "生活多彩！",
            archive: "共 {count} 篇文章",
            about: "一个极简的Blog模板",
            friends: "有趣的灵魂",
            page404: "恭喜你发现一片未知的世界，这片世界还处于建设之中，请过段时间再来看看呢！"
        }
    },
    toc: "目录",
    pageNavigation: {
        previous: "上一页",
        next: "下一页",
        currentPage: "第 {currentPage} 页，共 {totalPages} 页",
    },
    search: {
        placeholder: "输入关键词开始搜索",
        noresult: "未找到相关结果",
        error: "搜索出现错误，请稍后重试"
    },
    license: {
        author: "本文作者",
        url: "文章链接",
        description1: "文章默认使用",
        description2: "协议进行许可，使用时请注意遵守协议。"
    }
}

export default translation;