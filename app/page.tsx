import { Game } from "@/components/game";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ spectate?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex-1">
      <Game />
    </main>
  );
}
