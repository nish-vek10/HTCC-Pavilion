// pavilion-app/metro.config.js
// Metro bundler config — enables persistent cache for faster Expo Go starts

const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Persistent transform cache — survives Metro restarts, cuts re-bundle time
config.cacheStores = [
  new (require('metro-cache').FileStore)({
    root: require('path').join(__dirname, '.metro-cache'),
  }),
]

module.exports = config
