import type { Translation } from "@i18n/key";

const translation: Translation = {
    header: {
        home: "Home",
        archive: "Archive",
        about: "About",
        friends: "Friends",
    },
    cover: {
        title: {
            home: "Welcome to Momo's Blog",
            archive: "Archive",
            about: "About",
            friends: "Friends",
            page404: "Secret",
        },
        subTitle: {
            home: "Life is colorful!",
            archive: "Total of {count} articles",
            about: "A minimalist blog template",
            friends: "Interesting Souls",
            page404: "Congratulations on finding a new world, this world is still under construction, please wait a bit longer."
        }
    },
    pageNavigation: {
        previous: "Prev",
        next: "Next",
        currentPage: "Page {currentPage} of {totalPages}",
    },
    search: {
        placeholder: "Enter keywords to start searching",
        noresult: "No results found.",
        error: "Search error occurred. Please try again later."
    }
}

export default translation;