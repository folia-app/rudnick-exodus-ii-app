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
  },

  // force Safari not to cache (dev)
  chainWebpack: config => {
    if (process.env.NODE_ENV === 'development') {
      config
        .output
        .filename('[name].[hash].js')
        .end()
    }
  }
}
