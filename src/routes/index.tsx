import { createFileRoute } from "@tanstack/react-router";
import { MockupScreen } from "@/mockup/MockupScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Mes analyses" },
      { name: "description", content: "Contre-feu fait attaquer vos options par ceux qu’elles touchent, avant que vous ne tranchiez." },
      { property: "og:title", content: "Contre-feu — Mes analyses" },
      { property: "og:description", content: "Une décision argumentée en 30 minutes, face à un signal concurrent." },
    ],
  }),
  component: () => <MockupScreen screen="M2_Accueil" />,
});
