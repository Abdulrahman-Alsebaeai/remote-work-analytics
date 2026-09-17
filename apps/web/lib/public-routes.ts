const publicRoutes = new Set([
  "/",
  "/features",
  "/pricing",
  "/about",
  "/contact",
  "/docs",
  "/privacy",
  "/terms",
  "/cookies",
]);

export function isPublicMarketingRoute(pathname: string) {
  return publicRoutes.has(pathname) || pathname.startsWith("/docs/");
}
