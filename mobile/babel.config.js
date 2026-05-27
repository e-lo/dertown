module.exports = function (api) {
  // Cache per NODE_ENV so test and dev configs don't collide.
  api.cache(() => process.env.NODE_ENV);
  return {
    presets: ['babel-preset-expo'],
    // The Reanimated plugin transforms worklets at build time but interferes
    // with Jest's async model. Skip it in tests — no animations run in tests.
    plugins:
      process.env.NODE_ENV === 'test' ? [] : ['react-native-reanimated/plugin'],
  };
};
