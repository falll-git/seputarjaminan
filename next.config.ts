import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    localPatterns: [
      {
        pathname: "/media/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
