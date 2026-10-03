// next.config.mjs: Next.js config for a fully static export (no server at runtime).
// Deploy on Vercel with root directory `web`; the output lands in `out/`.

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
