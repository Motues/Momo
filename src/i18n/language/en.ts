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
    toc: "Contents",
    pageNavigation: {
        previous: "Prev",
        next: "Next",
        currentPage: "Page {currentPage} of {totalPages}",
    },
    search: {
        placeholder: "Enter keywords to start searching",
        noresult: "No results found.",
        error: "Search error occurred. Please try again later."
    },
    license: {
        author: "Author",
        license: "License",
        publishon: "Published on"
    },
    blogNavi: {
        next: "Next Blog",
        prev: "Previous Blog"
    },
    comments: {
        name: "Name",
        email: "Email",
        site: "Website",
        required: "Required",
        optional: "Optional",
        welcome: "Welcome to comment",
        comments: "Comments",
        cancel: "Cancel",
        send: "Send",
        sending: "Sending...",
        reply: "Reply",
        replyPlaceholder: "Write your reply...",
        loadMore: "Load more",
        loading: "Loading comments...",
        loadFailed: "Failed to load",
        submitSuccess: "Submitted successfully",
        submitFailed: "Submission failed, please try again later",
        fillRequired: "Please fill in name, email and comment content",
        confirmDelete: "Are you sure you want to delete this comment?",
        delete: "Delete",
        deleteSuccess: "Successfully deleted",
        deleteFailed: "Failed to delete",
        deleteError: "Failed to delete comment",
        characters: "characters",
        words: "words",
        contentTooLong: "Comment content exceeds limit: no more than 2000 characters or 1000 words"
    },
    langNote: {
        note: "Note: ",
        description: "This page does not support English, using the default language version"
    }
}

export default translation;