# Update Guide

This project is currently under active maintenance. To update, follow these steps:

First, verify the version number in `package.json` or review the changelog here or at [Release](https://github.com/Motues/Momo/releases).

The project version number is only incremented when the configuration file structure undergoes structural changes. Project configuration files refer to those related to website layout and content, including `astro.config.mjs`, `src/config.ts`, `src/content.config.ts`, and files within the `src/i18n/` folder.

Blog text, images, and other content are stored in the `src/content/`, `src/assets`, and `public` folders.

## Version Number Unchanged

You can directly clone this project, then overwrite the new project with your original configuration files. Run `pnpm install` to install dependencies, followed by `pnpm build` for local compilation. Finally, execute `pnpm preview` to preview the compiled project.

## Version Number Changed

Whenever the version number changes, the modification log will be updated here. Refer to the specific log entries to modify the corresponding configuration files.

Below are general modification suggestions.

* **`astro.config.mjs` Modifications**: Typically just overwrite the file, then update the `site` and `i18n` fields in `siteConfig` with your own information.
* **`config.ts` Modifications**: Update `config.ts` by adding or modifying configuration items as required.
* **`content.config.ts` Modifications**: Typically involves adding new frontmatter configurations to articles. Add the required new configuration items to articles as specified.
* **`src/i18n/` Modifications**: Generally involves adding new internationalization translations. Simply overwrite the files, then ensure to modify the `cover.title` and `cover.subtitle` fields with your own information.

## Version Information

> Version numbers follow the `YY.MM.DD` format

### v26.4.21

* Added AOS animation toggle configuration
* The comment system now supports Twikoo
* This update modifies the `config.ts` configuration file by adding the `theme.AOS` and `comments.platform` fields; these new fields must be added when updating

### v26.4.15

* Added the function for pined posts
* Updated the Music Card API URL
* Fixed some styling issues
* This update modifies the `astro.config.mjs` configuration file and adds a new dependency, `@iconify-json/fluent`. You must add the corresponding fields and run `pnpm install`.

### v26.4.7

* Fixed translation errors
* Changed the color of selected text
* Updated the Mucis Card API URL
* This update modifies the configuration file `src/i18n/language/en.ts` by changing the `themeInfo.system` field; all other fields remain unchanged. When updating, you only need to modify the fields that have changed.

### v26.3.29

* Updated the comment data structure to support the new version of the comment backend
* Optimized the styling of comments on mobile devices
* Fixed an issue where the category menu on the archive page was misaligned
* This update modifies the configuration file `src/i18n/` by adding the `comments.replyTo` field; all other fields remain unchanged. To apply the changes, simply add the new field

### v26.3.17

* Changed the style of comment avatars to circular
* Adjusted the margins of some components
* This update modifies the configuration file `src/i18n/` by adding the `themeInfo` field; all other fields remain unchanged. To apply the changes, simply add the new field

Translated with DeepL.com (free version)

### v26.3.11

* Initial release version `v26.3.11`
* Multiple project improvements, including: optimized mobile experience, unified website color scheme
* This update modifies the configuration file `src/i18n/`. We recommend using the latest version and updating the `cover.title` and `cover.subtitle` fields with your own information.
