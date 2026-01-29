const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable problematic metro externals that cause Windows path issues
config.resolver.blockList = [
  /.*\/node_modules\/expo\/.*\/externals\/.*/,
];

module.exports = config;
