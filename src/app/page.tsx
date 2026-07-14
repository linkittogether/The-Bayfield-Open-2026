import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/server/seasons";

// Always resolve the current season at request time — never cache the redirect,
// or switching the current season leaves the root pointing at the old year.
export const dynamic = "force-dynamic";

// The season lives in the URL path (/[year]/...). Root sends you to the current season.
export default async function RootPage() {
  const season = await getCurrentSeason();
  redirect(`/${season.year}`);
}
