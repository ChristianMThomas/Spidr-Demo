/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // This app is fully client-side with no static pages
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.base44.app' },
      { protocol: 'https', hostname: 'media.giphy.com' },
      { protocol: 'https', hostname: 'media0.giphy.com' },
      { protocol: 'https', hostname: 'media1.giphy.com' },
      { protocol: 'https', hostname: 'media2.giphy.com' },
      { protocol: 'https', hostname: 'media3.giphy.com' },
      { protocol: 'https', hostname: 'media4.giphy.com' },
    ],
  },
};

export default nextConfig;
