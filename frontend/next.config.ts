import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // 解决 MetaMask SDK 在浏览器环境中导入 React Native 包的警告
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
      };
    }

    return config;
  },

  // 确保开发和生产环境都有调试信息
  compiler: {
    removeConsole: false,
  },
};

export default nextConfig;
