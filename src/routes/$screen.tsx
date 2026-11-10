import { createFileRoute, notFound } from "@tanstack/react-router";
import { MockupScreen } from "@/mockup/MockupScreen";
import { slugToKey, TITLES } from "@/mockup/screens-map";

export const Route = createFileRoute("/$screen")({
  loader: ({ params }) => {
    const key = slugToKey(params.screen);
    if (!key) throw notFound();
    return { key };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? TITLES[loaderData.key].replace("Contre-feu v2", "Contre-feu") : "Contre-feu";
    return {
      meta: [
        { title },
        { name: "description", content: "Contre-feu — analysez un signal concurrent et décidez en 30 minutes." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Contre-feu — mettez vos options à l’épreuve avant de trancher." },
      ],
    };
  },
  component: ScreenPage,
});

function ScreenPage() {
  const { key } = Route.useLoaderData();
  return <MockupScreen screen={key} />;
}
