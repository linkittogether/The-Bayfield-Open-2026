import { notFound } from "next/navigation";
import { getSeasonByYear } from "@/lib/server/seasons";

// Validates the /[year] segment is a real season (404s otherwise).
export default async function YearLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const season = await getSeasonByYear(Number(year));
  if (!season) notFound();
  return <>{children}</>;
}
