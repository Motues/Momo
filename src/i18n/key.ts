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
            page404: string;
        };
        subTitle: {
            home: string;
            archive: string;
            about: string;
            friends: string;
            page404: string;
        };
    };
    toc:string;
    pageNavigation: {
        previous: string;
        next: string;
        currentPage: string;
    };
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
    },
    langNote: {
        note: string;
        description: string;
    }
}