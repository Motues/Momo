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
    };
    button: {
        switchDarkMode: string;
        backToTop: string;
        backToBottom: string;
        meun: string;
        toc: string;
        backToComments: string;
    }
    search: {
        placeholder: string;
        noresult: string;
        error: string;
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
        submitSuccess: string;
        submitFailed: string;
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
    },
    themeInfo: {
        light: string;
        dark: string;
        system: string;
    }
}