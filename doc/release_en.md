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

## v26.3.11

* Initial release version `v26.3.11`
* Multiple project improvements, including: optimized mobile experience, unified website color scheme
* This update modifies the configuration file `src/i18n/`. We recommend using the latest version and updating the `cover.title` and `cover.subtitle` fields with your own information.