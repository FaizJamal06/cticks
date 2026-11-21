/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/firebase-messaging-sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/" }] }];
  },
  // The Auth screen lives in the app; these open it on the right tab. Query strings (e.g. ?join=CODE) carry over.
  async redirects() {
    return [
      { source: "/login", destination: "/app?mode=login", permanent: false },
      { source: "/signup", destination: "/app?mode=signup", permanent: false },
    ];
  },
};
export default nextConfig;
