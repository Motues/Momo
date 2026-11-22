export interface Translation {
    header: {
        home: string;
        archive: string;
        about: string;
        friends: string;
    };
    cover: {
        title: {
            home: string;
            archive: string;
            about: string;
            friends: string;
        };
        subTitle: {
            home: string;
            archive: string;
            about: string;
            friends: string;
        };
    };
    toc:string;
    category: string;
    pageNavigation: {
        previous: string;
        next: string;
        currentPage: string;
        label: string;
        goToPage: string;
    };
    button: {
        switchDarkMode: string;
        backToTop: string;
        backToBottom: string;
        meun: string;
        toc: string;
        backToComments: string;
        scrollDown: string;
    }
    search: {
        placeholder: string;
        noresult: string;
        error: string;
        label: string;
        hint: string;
        searching: string;
        results: string;
        tip: string;
        devHint: string;
        page: string;
        history: string;
        clearHistory: string;
        allCategories: string;
        suggestions: string;
    };
    license: {
        author: string;
        license: string;
        publishon: string;
    };
    blogNavi: {
        next: string;
        prev: string;
    },
    pagecard: {
        words: string;
        minutes: string;
        uncategorized: string;
    }
    comments: {
        name: string;
        email: string;
        site: string;
        required: string;
        optional: string;
        welcome: string;
        comments: string;
        cancel: string;
        send: string;
        sending: string;
        reply: string;
        replyPlaceholder: string;
        loadMore: string;
        loading: string;
        loadFailed: string;
        networkError: string;
        submitSuccess: string;
        submitFailed: string;
        verificationRequired: string;
        fillRequired: string;
        confirmDelete: string;
        delete: string;
        deleteSuccess: string;
        deleteFailed: string;
        deleteError: string;
        characters: string;
        words: string;
        contentTooLong: string;
        replyTo: string;
        write: string;
        preview: string;
        previewError: string;
        codeFence: string;
        inlineCode: string;
        bold: string;
        italic: string;
        quote: string;
        code: string;
        link: string;
        image: string;
        list: string;
        showMoreReplies: string;
        collapseReplies: string;
        verifying: string;
        verifySuccess: string;
        verifyFailed: string;
        verifyRetry: string;
        verifyUnsupported: string;
        verifyBackendOutdated: string;
        verifyDomainBlocked: string;
        adminKey: string;
        adminKeyPlaceholder: string;
        emoji: string;
        emojiPanel: string;
        emojiLoading: string;
        emojiLoadFailed: string;
        emojiRetry: string;
        emojiEmpty: string;
        emojiStale: string;
        emojiPartial: string;
        emojiRefresh: string;
        emojiClose: string;
        linkDormantTip: string;
    },
    langNote: {
        note: string;
        description: string;
    },
    draftNote: {
        warning: string;
        description: string;
    },
    page404: {
        title: string;
        subTitle: string;
        backToHome: string;
        backToPreview: string;
        errorCode: string;
        notice: string;
        randomPost: string;
        recentPosts: string;
    },
    /** 无障碍标签：读屏软件念出来的文案，与可见文字分开维护 */
    a11y: {
        skipToContent: string;
        languageSwitcher: string;
        mobileMenu: string;
        closeMenu: string;
        previousPage: string;
        nextPage: string;
        imageViewer: string;
        previousImage: string;
        nextImage: string;
        zoomIn: string;
        zoomOut: string;
        resetZoom: string;
        closeImage: string;
    },

    themeInfo: {
        light: string;
        dark: string;
        system: string;
    }
}