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
        author: "作者",
        license: "许可协议",
        publishon: "发布时间"
    },
    blogNavi: {
        next: "下一篇",
        prev: "上一篇"
    },
    comments: {
        name: "昵称",
        email: "邮箱",
        site: "网站",
        required: "必填",
        optional: "选填",
        welcome: "欢迎评论",
        comments: "条评论",
        cancel: "取消",
        send: "发送",
        sending: "发送中...",
        reply: "回复",
        replyPlaceholder: "写下你的回复...",
        loadMore: "加载更多",
        loading: "正在加载评论...",
        loadFailed: "加载失败",
        submitSuccess: "提交成功",
        submitFailed: "提交失败，请稍后再试",
        fillRequired: "请填写昵称、邮箱和评论内容",
        confirmDelete: "确定要删除这条评论吗？",
        delete: "删除",
        deleteSuccess: "删除成功",
        deleteFailed: "删除失败",
        deleteError: "删除评论失败",
        characters: "字符",
        words: "单词",
        contentTooLong: "评论内容超出限制：不超过2000字或1000单词"
    },
    langNote: {
        note: "注意：",
        description: "当前页面不支持简体中文，使用默认语言版本"
    }
}

export default translation;