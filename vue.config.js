module.exports = {
  lintOnSave: false,

  // webpack
  configureWebpack: {
    optimization: {
      // split into smaller files for faster load?
      splitChunks: {
        minSize: 10000,
        maxSize: 250000
      }
    }
  }
}
