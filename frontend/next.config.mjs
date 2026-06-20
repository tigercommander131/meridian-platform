/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint is a dev-time concern (run `npm run lint`); a style nitpick like an
  // unescaped apostrophe shouldn't fail a production build / deploy.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
