// @ts-nocheck
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const SiteApp = lazy(() => import("./SiteApp"));

const Loading = () => <div style={{ minHeight: "100vh", background: "#0d0015" }} />;

export default function SiteMount() {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <SiteApp />
      </Suspense>
    </ClientOnly>
  );
}
