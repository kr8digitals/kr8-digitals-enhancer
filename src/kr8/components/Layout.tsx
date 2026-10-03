// @ts-nocheck
import { useEffect } from "react";
import { Outlet, useLocation } from "../router-shim";
import Navbar from "./Navbar";
import { logActivity } from "../lib/activityLog";
import Footer from "./Footer";
import SiteLiveBanner from "./SiteLiveBanner";
import FollowPopup from "./FollowPopup";

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    logActivity("page_view", { target: pathname });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteLiveBanner />
      <Navbar />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
      <FollowPopup />
    </div>
  );
}
