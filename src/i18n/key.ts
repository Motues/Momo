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
}