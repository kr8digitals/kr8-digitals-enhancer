// @ts-nocheck
/**
 * Two-Way Supabase Database Synchronization for KR8 Digitals
 *
 * 1. Hydrates site content, Agency portfolio, skill settings, team/founders,
 *    testimonials, announcements, and student/graduate records from Supabase DB
 *    into the reactive frontend stores on app startup.
 * 2. Listens for Admin Dashboard mutations (`kr8:*-updated`) and persists them
 *    directly into Supabase tables (`site_content`, `agency_portfolio`,
 *    `skill_settings`, `site_settings`, `profiles`) via server functions backed
 *    by `supabaseAdmin`.
 */

import {
  PORTFOLIO,
  getPortfolio,
  getFounders,
  getTeam,
  getTestimonials,
  getAnnouncements,
  getHomepageSettings,
  getAllSkillSettings,
  getCustomSkills,
  getAccounts,
  saveAccounts,
  OFFICIAL_WHATSAPP_LINKS,
} from "../data/store";
import { getSiteContent } from "../data/cmsStore";

let syncInitialized = false;
let isHydratingFromDb = false;

export async function syncToCloudNow(): Promise<boolean> {
  try {
    const { saveAdminSiteState } = await import("@/lib/public-data.functions");
    await Promise.all([
      saveAdminSiteState({
        data: { section: "agency", key: "portfolio_items", value: getPortfolio() },
      }),
      saveAdminSiteState({
        data: { section: "cms", key: "site_cms", value: getSiteContent() },
      }),
      saveAdminSiteState({
        data: { section: "skills", key: "skill_settings", value: getAllSkillSettings() },
      }),
      saveAdminSiteState({
        data: { section: "about", key: "founders", value: getFounders() },
      }),
      saveAdminSiteState({
        data: { section: "about", key: "team", value: getTeam() },
      }),
      saveAdminSiteState({
        data: { section: "home", key: "testimonials", value: getTestimonials() },
      }),
      saveAdminSiteState({
        data: { section: "home", key: "announcements", value: getAnnouncements() },
      }),
      saveAdminSiteState({
        data: { section: "settings", key: "homepage_settings", value: getHomepageSettings() },
      }),
    ]);
    return true;
  } catch (err) {
    console.warn("[supabaseSync] syncToCloudNow warning:", err);
    return false;
  }
}

export function initSupabaseSync(): void {
  if (typeof window === "undefined" || syncInitialized) return;
  syncInitialized = true;

  // 1. Hydrate from Supabase Database on startup
  (async () => {
    isHydratingFromDb = true;
    try {
      const { getAdminSiteState, getPublicLeaderboardAndFeed } = await import(
        "@/lib/public-data.functions"
      );

      const [siteState, pubData]: any[] = await Promise.all([
        getAdminSiteState().catch(() => null),
        getPublicLeaderboardAndFeed().catch(() => null),
      ]);

      // A. Hydrate Site Content & Portfolio from DB
      if (siteState?.ok) {
        const scRows: any[] = siteState.siteContent || [];
        const findSc = (page: string, key: string) =>
          scRows.find((r) => r.page === page && r.key === key)?.value;

        // CMS content
        const dbCms = findSc("cms", "site_cms");
        if (dbCms && typeof dbCms === "object") {
          const currentCms = getSiteContent();
          const mergedCms = { ...currentCms, ...dbCms };
          localStorage.setItem("kr8_site_cms_v1", JSON.stringify(mergedCms));
          window.dispatchEvent(new Event("kr8:cms-updated"));
        }

        // Agency Portfolio: Merge core 5 clients (`PORTFOLIO`) + DB `site_content` + `agency_portfolio` table
        const dbPortfolioSc = findSc("agency", "portfolio_items");
        const dbPortfolioTable = siteState.agencyPortfolio || [];
        const basePortfolio = [...PORTFOLIO];

        const addUniqueProject = (proj: any) => {
          if (!proj || !proj.title) return;
          const idx = basePortfolio.findIndex(
            (b) =>
              String(b.id) === String(proj.id) ||
              (b.client && proj.client && b.client.toLowerCase() === proj.client.toLowerCase() && b.title.toLowerCase() === proj.title.toLowerCase())
          );
          if (idx >= 0) {
            basePortfolio[idx] = {
              ...basePortfolio[idx],
              ...proj,
              category: proj.category || basePortfolio[idx].category || basePortfolio[idx].service,
            };
          } else {
            basePortfolio.push({
              ...proj,
              category: proj.category || proj.service || (proj.link ? "Website Development" : "Complete Branding"),
              service: proj.service || proj.category || (proj.link ? "Website Development" : "Complete Branding"),
            });
          }
        };

        if (Array.isArray(dbPortfolioSc)) {
          dbPortfolioSc.forEach(addUniqueProject);
        }
        if (Array.isArray(dbPortfolioTable)) {
          dbPortfolioTable.forEach((r: any) => {
            if (r.visible === false) return;
            addUniqueProject({
              id: r.id,
              title: r.title,
              client: r.client || r.title,
              service: r.category || (r.link ? "Website Development" : "Complete Branding"),
              category: r.category || (r.link ? "Website Development" : "Complete Branding"),
              price: "Custom Quote",
              showPrice: false,
              img: r.image_url || "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=900",
              description: r.description || "",
              link: r.link || undefined,
              liveDesktopPreview: Boolean(r.link),
            });
          });
        }
        localStorage.setItem("kr8_portfolio_v6", JSON.stringify(basePortfolio));
        window.dispatchEvent(new Event("kr8:portfolio-updated"));

        // Skill settings from DB
        if (Array.isArray(siteState.skillSettings) && siteState.skillSettings.length > 0) {
          const currentSettings = getAllSkillSettings();
          for (const row of siteState.skillSettings) {
            const k = row.skill_key;
            if (!k) continue;
            const officialWa =
              k === "graphic"
                ? OFFICIAL_WHATSAPP_LINKS.graphic
                : k === "web"
                ? OFFICIAL_WHATSAPP_LINKS.web
                : k === "video"
                ? OFFICIAL_WHATSAPP_LINKS.video
                : row.whatsapp_url;
            currentSettings[k] = {
              ...(currentSettings[k] || {}),
              registrationOpen: Boolean(row.registration_open),
              whatsapp: officialWa || row.whatsapp_url || "",
              instructor: row.instructor_name
                ? {
                    name: row.instructor_name,
                    bio: row.instructor_bio || "",
                    photo: row.instructor_photo || "",
                  }
                : currentSettings[k]?.instructor,
              curriculum:
                Array.isArray(row.curriculum) && row.curriculum.length > 0
                  ? row.curriculum
                  : currentSettings[k]?.curriculum,
            };
          }
          localStorage.setItem("kr8_skill_settings_v2", JSON.stringify(currentSettings));
          window.dispatchEvent(new Event("kr8:skill-settings-updated"));
        }
      }

      // B. Hydrate Live Student & Graduate Accounts into local store so Admin & Public pages see real DB users
      if (pubData?.ok && Array.isArray(pubData.leaderboard) && pubData.leaderboard.length > 0) {
        const existingLocal = getAccounts();
        const byId = new Map<string, any>();
        for (const acc of existingLocal) {
          byId.set(String(acc.id).toUpperCase(), acc);
        }

        for (const dbStudent of pubData.leaderboard) {
          const key = String(dbStudent.kr8_id || dbStudent.id).toUpperCase();
          if (!key) continue;
          const prev = byId.get(key) || {};
          byId.set(key, {
            ...prev,
            id: dbStudent.kr8_id || dbStudent.id,
            userId: dbStudent.userId || prev.userId,
            type: prev.type || "student",
            name: dbStudent.name || prev.name || "KR8 Scholar",
            email: dbStudent.email || prev.email || "",
            phone: dbStudent.phone || prev.phone || "",
            skill: dbStudent.skill || prev.skill || "graphic",
            year: dbStudent.year || prev.year || 2026,
            points: Number(dbStudent.points ?? prev.points ?? 50),
            attendanceAccepted: Number(dbStudent.attendanceAccepted ?? prev.attendanceAccepted ?? 0),
            submissions: Number(dbStudent.submissions ?? prev.submissions ?? 0),
            referrals: Number(dbStudent.referrals ?? prev.referrals ?? 0),
            graduated: Boolean(dbStudent.graduated || prev.graduated),
            certTier: dbStudent.certTier || prev.certTier || (dbStudent.graduated ? "Professionalism" : undefined),
            certRecognition: dbStudent.certRecognition || prev.certRecognition,
            verifyRemark: dbStudent.verifyRemark || prev.verifyRemark,
            avatar: dbStudent.avatar || prev.avatar || "",
            joined: dbStudent.joined || prev.joined || Date.now(),
          });
        }

        saveAccounts(Array.from(byId.values()));
      }
    } catch (err) {
      console.warn("[supabaseSync] initial hydration warning:", err);
    } finally {
      isHydratingFromDb = false;
    }
  })();

  // 2. Listen for Admin Dashboard changes and persist them to Supabase DB automatically
  const persistSection = async (section: string, key: string, getter: () => any) => {
    if (isHydratingFromDb) return;
    try {
      const { saveAdminSiteState } = await import("@/lib/public-data.functions");
      await saveAdminSiteState({
        data: {
          section,
          key,
          value: getter(),
        },
      });
    } catch (err) {
      console.warn(`[supabaseSync] Failed to persist ${section}.${key}:`, err);
    }
  };

  window.addEventListener("kr8:portfolio-updated", () =>
    persistSection("agency", "portfolio_items", getPortfolio)
  );
  window.addEventListener("kr8:cms-updated", () =>
    persistSection("cms", "site_cms", getSiteContent)
  );
  window.addEventListener("kr8:skill-settings-updated", () =>
    persistSection("skills", "skill_settings", getAllSkillSettings)
  );
  window.addEventListener("kr8:skills-updated", () =>
    persistSection("skills", "custom_skills", getCustomSkills)
  );
  window.addEventListener("kr8:founders-updated", () =>
    persistSection("about", "founders", getFounders)
  );
  window.addEventListener("kr8:team-updated", () =>
    persistSection("about", "team", getTeam)
  );
  window.addEventListener("kr8:testimonials-updated", () =>
    persistSection("home", "testimonials", getTestimonials)
  );
  window.addEventListener("kr8:announcements-updated", () =>
    persistSection("home", "announcements", getAnnouncements)
  );
  window.addEventListener("kr8:homepage-settings-updated", () =>
    persistSection("settings", "homepage_settings", getHomepageSettings)
  );
}
