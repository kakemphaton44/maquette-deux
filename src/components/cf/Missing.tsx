import { Link } from "@tanstack/react-router";
import { AppHeader } from "./ui";

export function Missing() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-4xl text-primary">Analyse introuvable</h1>
        <p className="mt-3 text-muted-foreground">Elle a peut-être été supprimée, ou créée dans un autre navigateur.</p>
        <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground no-underline">Mes analyses</Link>
      </main>
    </div>
  );
}

