import type { MetadataRoute } from "next";

// Served at /robots.txt. Without this, /robots.txt falls through to the
// /[year] dynamic route (year = "robots.txt") and 500s, which makes Google
// treat the whole site as uncrawlable and blocks OAuth verification.
const BASE_URL = "https://thebayfieldopen.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
