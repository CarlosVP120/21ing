import Game from "@/components/Game";

export default function Home() {
  return (
    <main className="min-h-screen bg-green-800 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          Online Blackjack
        </h1>
        <Game />
      </div>
    </main>
  );
}
