import { PlayerCard } from "@/components/player-card";
import { loadCards } from "@/lib/cards";

export const metadata = { title: "Player Cards — The Bayfield Open" };

// Local gallery of the player trading cards (one per authored players/<slug>.json).
export default async function CardsPage() {
  const cards = await loadCards();
  return (
    <main className="min-h-screen bg-[radial-gradient(120%_120%_at_50%_0%,#123a29_0%,#0a2418_45%,#05130c_100%)] px-4 py-12">
      <h1 className="mb-10 text-center font-heading text-3xl font-bold text-[#f0dcae]">
        The Bayfield Open — Player Cards
      </h1>
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 place-items-center gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.slug} className="w-full max-w-[440px]">
            <PlayerCard card={c} />
            {c.caption && (
              <p className="mt-3 text-center font-serif text-[13px] tracking-wide text-[#cdb98a]">
                {c.caption}
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
