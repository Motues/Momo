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
        },
        subTitle: {
            home: "生活多彩！",
            archive: "共 {count} 篇文章",
            about: "一个极简的Blog模板",
            friends: "有趣的灵魂",
        }
    },
    toc: "目录",
    category: "分类",
    pageNavigation: {
        previous: "上一页",
        next: "下一页",
        currentPage: "第 {currentPage} 页，共 {totalPages} 页",
    },
    button: {
        switchDarkMode: "切换明暗模式",
        backToTop: "回到顶部",
        backToBottom: "回到底部",
        meun: "菜单",
        toc: "目录",
        backToComments: "前往评论区",
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
    pagecard: {
        words: "字",
        minutes: "分钟",
        uncategorized: "未分类"
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
        contentTooLong: "评论内容超出限制：不超过2000字或1000单词",
        replyTo: "回复"
    },
    langNote: {
        note: "注意：",
        description: "当前页面不支持简体中文，使用默认语言版本"
    },
    draftNote: {
        warning: "草稿警告：",
        description: "此文章为草稿，只出现在测试环境，生产环境将不会显示。"
    },
    page404: {
        title: "404 - 虚无之境",
        subTitle: "看起来你闯入了一片代码荒原，这里还没有被开发出来。",
        backToHome: "返回首页",
        backToPreview: "返回上一页",
        errorCode: "错误代码：404 - 虚无之境",
        notice: "或许你可以尝试："
    },
    themeInfo: {
        light: "切换到 浅色 模式",
        dark: "切换到 深色 模式",
        system: "切换到 跟随系统 模式"
    }
}

export default translation;