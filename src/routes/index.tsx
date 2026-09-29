import { createFileRoute } from "@tanstack/react-router";
import SiteMount from "@/kr8/SiteMount";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KR8 Digitals — Learn Free. Belong Deeply. Build for Real." },
      { name: "description", content: "KR8 Digitals is an impact-driven creative ecosystem empowering African talent through tuition-free digital skills training, community and agency work." },
      { property: "og:title", content: "KR8 Digitals — Learn Free. Belong Deeply. Build for Real." },
      { property: "og:description", content: "Empowering the next generation of African creative and digital innovators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://kr8digitals.com/og-image.png" },
      { name: "twitter:image", content: "https://kr8digitals.com/og-image.png" },
    ],
  }),
  component: SiteMount,
});
