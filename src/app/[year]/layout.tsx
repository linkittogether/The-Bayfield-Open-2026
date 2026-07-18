import { notFound, redirect } from "next/navigation";
import { getSeasonByYear } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";

// Gates every /[year] route: the tournament is private, so sign-in is required
// to view any season. Also validates the /[year] segment is a real season.
export default async function YearLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const [user, season] = await Promise.all([
    getCurrentUser(),
    getSeasonByYear(Number(year)),
  ]);
  if (!user) redirect("/login");
  if (!season) notFound();
  return <>{children}</>;
}
