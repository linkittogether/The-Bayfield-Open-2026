import { PlayerCard } from "@/components/player-card";
import { loadCard } from "@/lib/cards";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const card = await loadCard(slug ?? "joe-mcculla");
  return (
    <>
      <style>{`html,body{background:transparent !important;margin:0;padding:0}`}</style>
      <main style={{ background: "transparent", margin: 0, padding: "40px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: 800 }}>
          <PlayerCard card={card} />
        </div>
      </main>
    </>
  );
}
