const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration to handle event-target-shim warnings
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Handle event-target-shim module resolution and other common issues
config.resolver.alias = {
  'event-target-shim': require.resolve('event-target-shim'),
};

// Add unstable_enablePackageExports to handle modern package.json exports
config.resolver.unstable_enablePackageExports = true;

// Suppress specific warnings for known issues
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  keep_fnames: true,
};

module.exports = config;
