import { AppShell } from "@/components/app-shell";
import { getSeasonCourseSetup } from "@/lib/server/courses";
import { getSeasonView } from "@/lib/server/seasons";
import { getCurrentUser } from "@/lib/session";
import { TeeEditor } from "./tee-editor";

export const metadata = { title: "Courses & Tees" };

const DAY_LABEL: Record<number, string> = { 1: "Friday", 2: "Saturday", 3: "Sunday" };

export default async function CoursesPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yr = Number(year);
  const [{ viewed: season, readOnly }, user] = await Promise.all([
    getSeasonView(yr),
    getCurrentUser(),
  ]);

  if (user?.kind !== "admin") {
    return (
      <AppShell title="Courses & Tees" showBack backTo={`/${yr}`} year={yr}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Course &amp; tee setup is admin-only.
        </div>
      </AppShell>
    );
  }

  const segs = await getSeasonCourseSetup(season.id);
  const byDay = new Map<number, typeof segs>();
  for (const s of segs) {
    const arr = byDay.get(s.day) ?? [];
    arr.push(s);
    byDay.set(s.day, arr);
  }

  return (
    <AppShell title="Courses & Tees" showBack backTo={`/${yr}`} year={yr}>
      <p className="text-xs text-muted-foreground mb-4">
        Pick the tee played for each round. Rating, slope and par are pulled from The Grint for the
        chosen tee (and, for match play, the per-hole stroke index).
        {readOnly && " This is a past season — read-only."}
      </p>

      {segs.length === 0 && (
        <p className="text-sm text-muted-foreground">No rounds configured for this season yet.</p>
      )}

      <div className="space-y-5">
        {[...byDay.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([day, daySegs]) => (
            <div key={day}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {DAY_LABEL[day] ?? `Day ${day}`}
              </h3>
              <div className="flex flex-col gap-3">
                {daySegs.map((s) => (
                  <TeeEditor key={s.segmentId} segment={s} readOnly={readOnly} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </AppShell>
  );
}
