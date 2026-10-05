import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // MODE B (proxy). When BACKEND_ORIGIN is set, Next forwards the same
  // relative paths the original Thymeleaf pages used (/orders/all,
  // /admin/orders/..., /files/..., /api/order-chat/...) to the backend, so the
  // browser only ever talks to our own origin and CORS never comes into play.
  //
  // Two constraints worth knowing:
  //   1. Rewrites require a running Node server. They are inert in a static
  //      export — use MODE A (NEXT_PUBLIC_API_BASE_URL) for static hosting.
  //   2. Rewrites cannot proxy a WebSocket upgrade, which is why /ws is NOT
  //      listed below. Point NEXT_PUBLIC_WS_URL straight at the backend.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN;
    if (!backend) return [];
    return [
      { source: '/auth/:path*', destination: `${backend}/auth/:path*` },
      { source: '/admin/:path*', destination: `${backend}/admin/:path*` },
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/orders/:path*', destination: `${backend}/orders/:path*` },
      { source: '/expert/:path*', destination: `${backend}/expert/:path*` },
      { source: '/emp/:path*', destination: `${backend}/emp/:path*` },
      { source: '/files/:path*', destination: `${backend}/files/:path*` },
      { source: '/payments/:path*', destination: `${backend}/payments/:path*` },
      { source: '/installments/:path*', destination: `${backend}/installments/:path*` },
      { source: '/student/:path*', destination: `${backend}/student/:path*` },
      { source: '/wallet/:path*', destination: `${backend}/wallet/:path*` },
    ];
  },
};

export default nextConfig;
