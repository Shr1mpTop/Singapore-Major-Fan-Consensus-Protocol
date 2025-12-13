/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly disable Turbopack and use webpack
  experimental: {
    webpackBuildWorker: true,
  },

  // Empty turbopack config to silence the warning
  turbopack: {},

  webpack: (config, { isServer }) => {
    // Exclude test files from certain packages that incorrectly include them
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Add plugin to ignore problematic modules
    const webpack = require('webpack');
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(tap|tape|why-is-node-running)$/,
      })
    );

    // Ignore specific test files
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'thread-stream/test/transpiled.test.js': '{}',
        'thread-stream/test/indexes.js': '{}',
        'thread-stream/test/helper.js': '{}',
      });
    }

    return config;
  },

  // Exclude problematic packages from server components
  serverExternalPackages: ['pino', 'thread-stream'],
};

module.exports = nextConfig;