// Stands for an image file a dependency imports (twake-mui's dialogs import
// PNG files): the bundler gives its URL, Jest cannot parse it (see
// `moduleNameMapper`). A default export, as the files it stands for.
// eslint-disable-next-line no-restricted-syntax
export default 'test-file-stub'
