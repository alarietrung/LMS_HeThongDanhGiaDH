const api = process.env.API_ORIGIN || "http://127.0.0.1:4100";
export default {
  poweredByHeader: false,
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/auth/:path*", destination: `${api}/auth/:path*` },
      { source: "/health/:path*", destination: `${api}/health/:path*` },
    ];
  },
  async headers() {
    const production = process.env.NODE_ENV === "production";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${production ? "" : "'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.blob.core.windows.net ${production ? "" : "ws: wss:"}; font-src 'self'; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
          },
          ...(production
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
};
