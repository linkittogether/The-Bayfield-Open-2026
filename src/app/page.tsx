import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/lib/server/seasons";

// The season lives in the URL path (/[year]/...). Root sends you to the current season.
export default async function RootPage() {
  const season = await getCurrentSeason();
  redirect(`/${season.year}`);
}
