/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.1.118", "192.168.1.*", "localhost", "127.0.0.1"],
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
      {
        source: "/login",
        destination: "/auth/v2/login",
        permanent: false,
      },
      {
        source: "/auth/login",
        destination: "/auth/v2/login",
        permanent: false,
      },
      {
        source: "/auth/v1/login",
        destination: "/auth/v2/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
