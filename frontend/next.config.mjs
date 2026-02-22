/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
      };
    } else {
      config.externals = [...(config.externals || []), "onnxruntime-node"];
    }
    return config;
  },
  turbopack: {},
  serverExternalPackages: ["onnxruntime-node"],
};

export default nextConfig;
