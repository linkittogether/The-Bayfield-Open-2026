import type { MetadataRoute } from "next";

// Served at /sitemap.xml. Like robots.txt, without this the request falls
// through to the /[year] dynamic route and 500s. Lists the public,
// crawlable pages (the tournament app itself sits behind Google sign-in).
const BASE_URL = "https://thebayfieldopen.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/`, priority: 1 },
    { url: `${BASE_URL}/privacy`, priority: 0.5 },
  ];
}
