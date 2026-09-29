import { createFileRoute } from "@tanstack/react-router";
import SiteMount from "@/kr8/SiteMount";

export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [
      { title: "KR8 Digitals" },
      { name: "description", content: "KR8 Digitals — tuition-free creative academy, tribe community and digital agency." },
      { property: "og:title", content: "KR8 Digitals" },
      { property: "og:description", content: "Tuition-free creative academy, tribe community and digital agency." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SiteMount,
});
