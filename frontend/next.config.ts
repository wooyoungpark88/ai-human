import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["three", "@pixiv/three-vrm", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
