/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force webpack instead of turbopack for compatibility
  experimental: {
    webpackBuildWorker: true,
  },

  webpack: (config, { isServer }) => {
    // Exclude test files from certain packages that incorrectly include them
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Add plugin to ignore problematic modules
    config.plugins.push(
      new config.webpack.IgnorePlugin({
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