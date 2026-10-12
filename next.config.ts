import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // MODE B (proxy). When BACKEND_ORIGIN is set, Next forwards the same
  // relative paths the original Thymeleaf pages used (/admin/all,
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
    const to = (prefix: string) => ({
      source: `/${prefix}/:path*`,
      destination: `${backend}/${prefix}/:path*`,
    });
    return {
      /**
       * /admin and /expert are both page prefixes AND backend prefixes, and
       * some paths are literally both: /admin/orders/{id} (the order detail
       * page, and GET order detail), /expert/orders, /expert/dashboard and
       * /expert/profile. Ordinary rewrites get this wrong both ways — a static
       * page answers its API twin with HTML, and an API rewrite runs before
       * dynamic pages, so /admin/orders/1052 would load as JSON.
       *
       * Every API call carries the bearer token and a page request never does,
       * so authenticated requests under these prefixes go to the backend before
       * any page is matched, and everything else reaches the pages first.
       */
      beforeFiles: ['admin', 'expert'].map((prefix) => ({
        ...to(prefix),
        has: [{ type: 'header' as const, key: 'authorization' }],
      })),
      // Prefixes that have no pages in this app.
      afterFiles: ['auth', 'api', 'orders', 'emp', 'files', 'payments', 'installments', 'student', 'wallet'].map(to),
      // Unauthenticated /admin or /expert paths that match no page.
      fallback: ['admin', 'expert'].map(to),
    };
  },
};

export default nextConfig;
