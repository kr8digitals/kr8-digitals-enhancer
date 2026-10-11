import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

let lastReconcileAt = 0;
const RECONCILE_TTL_MS = 90 * 1000;

const OFFICIAL_WA_URLS: Record<string, string> = {
  graphic: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4",
  web: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4",
  frontend: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4",
  video: "https://chat.whatsapp.com/C9IyCVi8pWMJJUsErJhQ0M?s=cl&p=a&mlu=4&ilr=4",
  content_creation: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4",
  smm: "https://chat.whatsapp.com/KdzTcSlrGlp8CQcbxFuUgU?s=cl&p=a&mlu=4&ilr=4",
  marketing: "https://chat.whatsapp.com/EqdAOw1TxiM7KqTB5EXh8v?s=cl&p=a&mlu=4&ilr=4",
};

const SKILL_DISPLAY_NAMES: Record<string, string> = {
  graphic: "Graphic Design",
  video: "Video Editing & Animation",
  web: "Website Development",
  frontend: "Front-End Development",
  content_creation: "Content Creation",
  smm: "Social Media Management",
  marketing: "Digital Marketing",
};

export async function reconcileDatabaseState(force = false) {
  const now = Date.now();
  if (!force && now - lastReconcileAt < RECONCILE_TTL_MS) return;
  lastReconcileAt = now;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Ensure Founder & Co-Founder user_roles exist in DB
    try {
      const { data: execProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, phone, phone_normalized, kr8_id, name")
        .or(
          "email.ilike.kr8digitals01@gmail.com,email.ilike.kutimfire001@gmail.com,phone_normalized.in.(2348125687509,2348166552758,2348089344434,2348106068523)"
        );

      if (execProfiles && execProfiles.length > 0) {
        for (const p of execProfiles) {
          const emailLower = (p.email || "").toLowerCase();
          const phoneNorm = (p.phone_normalized || p.phone || "").replace(/[^0-9]/g, "");
          const isFounder =
            emailLower === "kr8digitals01@gmail.com" ||
            emailLower === "kutimfire001@gmail.com" ||
            phoneNorm.endsWith("8125687509") ||
            phoneNorm.endsWith("8166552758");
          const isCoFounder =
            !isFounder &&
            (phoneNorm.endsWith("8089344434") || phoneNorm.endsWith("8106068523"));

          if (isFounder) {
            await supabaseAdmin.from("user_roles").upsert(
              {
                user_id: p.id,
                role: "founder",
                title: "Founder & CEO",
                permissions: [
                  "all",
                  "view_students",
                  "issue_certificates",
                  "review_attendance",
                  "manage_content",
                  "manage_live",
                  "moderation",
                  "manage_links",
                  "view_finance",
                  "manage_roles",
                ],
              } as any,
              { onConflict: "user_id,role" }
            );
          } else if (isCoFounder) {
            await supabaseAdmin.from("user_roles").upsert(
              {
                user_id: p.id,
                role: "co-founder",
                title: "Co-Founder",
                permissions: [
                  "all",
                  "view_students",
                  "issue_certificates",
                  "review_attendance",
                  "manage_content",
                  "manage_live",
                  "moderation",
                  "manage_links",
                  "view_finance",
                  "manage_roles",
                ],
              } as any,
              { onConflict: "user_id,role" }
            );
          }
        }
      }
    } catch {}

    // 2. Sync official WhatsApp links in skill_settings if legacy links exist
    try {
      const { data: skills } = await supabaseAdmin
        .from("skill_settings")
        .select("skill_key, whatsapp_url");
      if (skills && skills.length > 0) {
        for (const sk of skills) {
          const officialUrl = OFFICIAL_WA_URLS[sk.skill_key];
          if (!officialUrl) continue;
          const currentUrl = (sk.whatsapp_url || "").trim();
          if (
            !currentUrl ||
            currentUrl.includes("DgnBOEd5CfMHV8CTWgPNLH") ||
            !currentUrl.includes("?s=cl")
          ) {
            await supabaseAdmin
              .from("skill_settings")
              .update({ whatsapp_url: officialUrl, updated_at: new Date().toISOString() })
              .eq("skill_key", sk.skill_key);
          }
        }
      }
    } catch {}

    // 3. Fix broken Google Drive URLs in team_members
    try {
      const { data: team } = await supabaseAdmin
        .from("team_members")
        .select("id, name, photo_url");
      if (team && team.length > 0) {
        for (const member of team) {
          const url = member.photo_url || "";
          const nameLower = (member.name || "").toLowerCase();
          if (url.includes("drive.google.com") || url.includes("googleusercontent.com")) {
            let fixedUrl = "/founder_timfire_wide.jpg";
            if (nameLower.includes("stevenson") || nameLower.includes("motionverse") || url.includes("1GFIv8Ho101udn2IbSiz5Zq8G92XJn2AU")) {
              fixedUrl = "/team/stevenson.jpg";
            } else if (nameLower.includes("daniel") || nameLower.includes("creative expression") || url.includes("1Ssje7WtVFMd8TZxMfrex1S0lKG6p_Wp9")) {
              fixedUrl = "/team/daniel.jpg";
            }
            await supabaseAdmin
              .from("team_members")
              .update({ photo_url: fixedUrl })
              .eq("id", member.id);
          }
        }
      }
    } catch {}

    // 4. Reconcile profiles.graduated <-> public.certificates
    try {
      const [{ data: activeCerts }, { data: allProfiles }] = await Promise.all([
        supabaseAdmin.from("certificates").select("*").eq("status", "active"),
        supabaseAdmin
          .from("profiles")
          .select("id, kr8_id, name, email, skill, graduated, cert_tier, cert_recognition, created_at"),
      ]);

      const profileById = new Map<string, any>();
      const profileByKr8 = new Map<string, any>();
      (allProfiles || []).forEach((p: any) => {
        if (p.id) profileById.set(p.id, p);
        if (p.kr8_id) profileByKr8.set(String(p.kr8_id).toUpperCase(), p);
      });

      const certProfileIds = new Set<string>();
      for (const cert of activeCerts || []) {
        const matchedProfile =
          profileById.get(cert.student_id) ||
          (cert.kr8_id ? profileByKr8.get(String(cert.kr8_id).toUpperCase()) : null);
        if (matchedProfile) {
          certProfileIds.add(matchedProfile.id);
          if (!matchedProfile.graduated || !matchedProfile.cert_tier) {
            await supabaseAdmin
              .from("profiles")
              .update({
                graduated: true,
                cert_tier: cert.tier || "Professionalism",
                cert_recognition: cert.additional_notes || matchedProfile.cert_recognition || null,
              })
              .eq("id", matchedProfile.id);
          }
        }
      }

      // If any profile is marked graduated = true in DB but missing an active certificate row, create one
      for (const p of allProfiles || []) {
        if (p.graduated && !certProfileIds.has(p.id) && p.kr8_id) {
          const skillKey = p.skill || "graphic";
          const skillName = SKILL_DISPLAY_NAMES[skillKey] || skillKey;
          const tier = p.cert_tier === "Completion" ? "Completion" : "Professionalism";
          const certCode = `CERT-KR8-${p.kr8_id}-${skillKey.toUpperCase()}`;
          await supabaseAdmin.from("certificates").upsert(
            {
              certificate_code: certCode,
              student_id: p.id,
              kr8_id: p.kr8_id,
              student_name: p.name,
              formatted_name: String(p.name || "").toUpperCase(),
              skill: skillKey,
              skill_name: skillName,
              tier,
              template_url: `/certificates/reusable_${tier.toLowerCase()}.png`,
              achievement_text:
                tier === "Professionalism"
                  ? "demonstrating excellence and proficiency in turning client requests into client satisfaction."
                  : "gaining hands-on experience in turning client requests into finished designs.",
              additional_notes: p.cert_recognition || null,
              issued_at: p.created_at || new Date().toISOString(),
              status: "active",
            } as any,
            { onConflict: "certificate_code" }
          );
        }
      }
    } catch {}
  } catch (err) {
    console.warn("[reconcileDatabaseState] non-fatal warning:", err);
  }
}

function hasPositiveComment(text?: string | null): boolean {
  if (!text || !text.trim()) return false;
  return text.trim().length >= 3;
}

export const getPublicLeaderboardAndFeed = createServerFn({ method: "GET" }).handler(async () => {
  await reconcileDatabaseState(false);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [
    profilesRes,
    certsRes,
    enrollmentsRes,
    remarksRes,
    submissionsRes,
    ledgerRes,
    activityRes,
    rolesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "id, kr8_id, name, email, skill, avatar, points, attendance_accepted, submissions, referrals, graduated, cert_tier, cert_recognition, bio, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("certificates")
      .select(
        "id, certificate_code, student_id, kr8_id, student_name, skill, skill_name, tier, achievement_text, additional_notes, issued_at, status"
      )
      .eq("status", "active")
      .order("issued_at", { ascending: false }),
    supabaseAdmin
      .from("enrollments")
      .select("user_id, skill_key, skill_name, graduated, enrolled_at, graduated_at"),
    supabaseAdmin
      .from("verify_remarks")
      .select("id, target_type, target_id, remark, visible_public, created_at")
      .eq("visible_public", true)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("attendance_submissions")
      .select("id, user_id, kr8_id, student_name, skill, class_topic, status, points_awarded, created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabaseAdmin
      .from("points_ledger")
      .select("id, user_id, kr8_id, points_change, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabaseAdmin
      .from("activity_log")
      .select("id, actor_id, action, target, details, created_at")
      .order("created_at", { ascending: false })
      .limit(150),
    supabaseAdmin.from("user_roles").select("user_id, role, title"),
  ]);

  const profiles = profilesRes.data || [];
  const certs = certsRes.data || [];
  const enrollments = enrollmentsRes.data || [];
  const remarks = remarksRes.data || [];
  const attendanceSubs = submissionsRes.data || [];
  const ledger = ledgerRes.data || [];
  const activities = activityRes.data || [];
  const roles = rolesRes.data || [];

  // Index roles
  const rolesByUser = new Map<string, string[]>();
  for (const r of roles) {
    const arr = rolesByUser.get(r.user_id) || [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  }

  // Index certificates by student_id and kr8_id
  const certsByUserId = new Map<string, any[]>();
  const certsByKr8Id = new Map<string, any[]>();
  for (const c of certs) {
    if (c.student_id) {
      const list = certsByUserId.get(c.student_id) || [];
      list.push(c);
      certsByUserId.set(c.student_id, list);
    }
    if (c.kr8_id) {
      const k = String(c.kr8_id).toUpperCase();
      const list = certsByKr8Id.get(k) || [];
      list.push(c);
      certsByKr8Id.set(k, list);
    }
  }

  // Index enrollments by user_id
  const skillsByUserId = new Map<string, Set<string>>();
  for (const e of enrollments) {
    if (!e.user_id || !e.skill_key) continue;
    const set = skillsByUserId.get(e.user_id) || new Set<string>();
    set.add(e.skill_key);
    skillsByUserId.set(e.user_id, set);
  }

  // Index public verify remarks by target_id (KR8 ID or cert code)
  const remarksByTarget = new Map<string, string[]>();
  for (const rem of remarks) {
    if (!rem.target_id || !rem.remark) continue;
    const key = String(rem.target_id).toUpperCase();
    const list = remarksByTarget.get(key) || [];
    list.push(rem.remark);
    remarksByTarget.set(key, list);
  }

  // Index attendance & assignment submissions by user_id / kr8_id
  const subCountByUser = new Map<string, { assignments: number; attendance: number }>();
  for (const sub of attendanceSubs) {
    if (sub.status === "rejected") continue;
    const key = sub.user_id || String(sub.kr8_id || "").toUpperCase();
    if (!key) continue;
    const curr = subCountByUser.get(key) || { assignments: 0, attendance: 0 };
    const topicLower = (sub.class_topic || "").toLowerCase();
    if (topicLower.includes("assign") || topicLower.includes("project") || topicLower.includes("drill")) {
      curr.assignments += 1;
    } else {
      curr.attendance += 1;
    }
    subCountByUser.set(key, curr);
  }

  // Index real-time activity / task counts by user_id
  const taskCountByUser = new Map<string, number>();
  for (const act of activities) {
    if (!act.actor_id) continue;
    taskCountByUser.set(act.actor_id, (taskCountByUser.get(act.actor_id) || 0) + 1);
  }
  const ledgerPointsByUser = new Map<string, number>();
  for (const l of ledger) {
    const key = l.user_id || String(l.kr8_id || "").toUpperCase();
    if (!key) continue;
    ledgerPointsByUser.set(key, (ledgerPointsByUser.get(key) || 0) + Number(l.points_change || 0));
  }

  // Build unified Leaderboard entries from all real database records
  const leaderboardEntries: any[] = [];
  const seenKr8Ids = new Set<string>();

  for (const p of profiles) {
    const kr8Upper = String(p.kr8_id || "").toUpperCase();
    if (kr8Upper) seenKr8Ids.add(kr8Upper);

    const userRoles = rolesByUser.get(p.id) || [];
    // Skip pure founder/system accounts from competing against students on the student leaderboard if desired,
    // or include students/graduates/tribe members
    const isFounderRole =
      userRoles.includes("founder") ||
      (p.email || "").toLowerCase() === "kr8digitals01@gmail.com" ||
      (p.email || "").toLowerCase() === "kutimfire001@gmail.com";
    if (isFounderRole) continue;

    const userCerts = [
      ...(certsByUserId.get(p.id) || []),
      ...(kr8Upper ? certsByKr8Id.get(kr8Upper) || [] : []),
    ];
    // Deduplicate certificates by id or certificate_code
    const uniqueCertsMap = new Map<string, any>();
    for (const c of userCerts) {
      uniqueCertsMap.set(c.certificate_code || c.id, c);
    }
    const activeUserCerts = Array.from(uniqueCertsMap.values());

    // Collect distinct skills across profile, enrollments, and certificates
    const skillSet = new Set<string>();
    if (p.skill) skillSet.add(p.skill);
    const enrolledSet = skillsByUserId.get(p.id);
    if (enrolledSet) enrolledSet.forEach((s) => skillSet.add(s));
    activeUserCerts.forEach((c) => {
      if (c.skill) skillSet.add(c.skill);
    });
    const skillsArray = Array.from(skillSet);
    const multiSkillCount = Math.max(1, skillsArray.length);

    // Determine Graduation & Distinction (Excellence / Professionalism vs Completed / Completion)
    const isGraduated = Boolean(p.graduated || activeUserCerts.length > 0);
    const hasExcellence =
      activeUserCerts.some((c) => c.tier === "Professionalism") ||
      (p.graduated && p.cert_tier === "Professionalism");
    const distinction: "Excellence" | "Completed" | null = isGraduated
      ? hasExcellence
        ? "Excellence"
        : "Completed"
      : null;

    // Collect good comments / recognitions from certificates, profile, and verify_remarks
    const comments: string[] = [];
    if (hasPositiveComment(p.cert_recognition)) comments.push(p.cert_recognition.trim());
    for (const c of activeUserCerts) {
      if (hasPositiveComment(c.additional_notes) && !comments.includes(c.additional_notes.trim())) {
        comments.push(c.additional_notes.trim());
      }
      const certRems = remarksByTarget.get(String(c.certificate_code || "").toUpperCase()) || [];
      for (const r of certRems) {
        if (!comments.includes(r)) comments.push(r);
      }
    }
    if (kr8Upper) {
      const studentRems = remarksByTarget.get(kr8Upper) || [];
      for (const r of studentRems) {
        if (!comments.includes(r)) comments.push(r);
      }
    }

    // Calculate comprehensive points from DB signals
    const subStatsById = subCountByUser.get(p.id) || { assignments: 0, attendance: 0 };
    const subStatsByKr8 = kr8Upper
      ? subCountByUser.get(kr8Upper) || { assignments: 0, attendance: 0 }
      : { assignments: 0, attendance: 0 };

    const submissionsCount = Math.max(
      Number(p.submissions || 0),
      subStatsById.assignments + subStatsByKr8.assignments,
      isGraduated ? 6 : 0
    );
    const attendanceCount = Math.max(
      Number(p.attendance_accepted || 0),
      subStatsById.attendance + subStatsByKr8.attendance,
      isGraduated ? 12 : 0
    );
    const referralsCount = Number(p.referrals || 0);
    const tasksCount = taskCountByUser.get(p.id) || 0;

    // Graduation points: Excellence (Professionalism) = 250 XP, Completed (Completion) = 150 XP
    let gradPoints = 0;
    if (activeUserCerts.length > 0) {
      for (const c of activeUserCerts) {
        gradPoints += c.tier === "Professionalism" ? 250 : 150;
      }
    } else if (isGraduated) {
      gradPoints = hasExcellence ? 250 : 150;
    }

    // Good comments / commendation bonus: +75 XP per commendation/remark
    const commentBonus = comments.length * 75;
    // Double / Multi-skill bonus: +120 XP per additional skill
    const multiSkillBonus = multiSkillCount > 1 ? (multiSkillCount - 1) * 120 : 0;
    // Submissions & attendance points
    const submissionPoints = submissionsCount * 25;
    const attendancePoints = attendanceCount * 10;
    const referralPoints = referralsCount * 20;
    const activityPoints = Math.min(tasksCount * 15, 150);

    const baseDbPoints = Math.max(
      Number(p.points || 0),
      ledgerPointsByUser.get(p.id) || 0,
      kr8Upper ? ledgerPointsByUser.get(kr8Upper) || 0 : 0
    );

    const calculatedPoints =
      baseDbPoints +
      gradPoints +
      commentBonus +
      multiSkillBonus +
      submissionPoints +
      attendancePoints +
      referralPoints +
      activityPoints;

    const primarySkillKey = p.skill || skillsArray[0] || "graphic";
    const skillDisplay =
      skillsArray.length > 1
        ? skillsArray.map((k) => SKILL_DISPLAY_NAMES[k] || k).join(" · ")
        : SKILL_DISPLAY_NAMES[primarySkillKey] || primarySkillKey;

    leaderboardEntries.push({
      user_id: p.id,
      userId: p.id,
      id: p.kr8_id || p.id,
      kr8_id: p.kr8_id || p.id,
      name: p.name || "KR8 Scholar",
      avatar: p.avatar || null,
      skill: primarySkillKey,
      skillName: skillDisplay,
      skillDisplay,
      skills: skillsArray,
      multiSkillCount,
      graduated: isGraduated,
      isExcellent: hasExcellence,
      distinction, // "Excellence" | "Completed" | null
      certTier: hasExcellence ? "Professionalism" : isGraduated ? "Completion" : null,
      certRecognition: comments[0] || null,
      hasGoodComment: comments.length > 0,
      commendation: comments[0] || null,
      commentsCount: comments.length,
      submissions: submissionsCount,
      submissionsCount,
      attendanceAccepted: attendanceCount,
      attendanceCount,
      referrals: referralsCount,
      referralsCount,
      tasksCount,
      points: calculatedPoints,
      created_at: p.created_at,
    });
  }

  // Also include any certificate holders whose profile wasn't in the first 1000 profiles
  for (const c of certs) {
    const kr8Upper = String(c.kr8_id || "").toUpperCase();
    if (!kr8Upper || seenKr8Ids.has(kr8Upper)) continue;
    seenKr8Ids.add(kr8Upper);

    const isExcellence = c.tier === "Professionalism";
    const comment = hasPositiveComment(c.additional_notes) ? c.additional_notes.trim() : null;
    const points = (isExcellence ? 250 : 150) + (comment ? 75 : 0) + 6 * 25 + 12 * 10;
    const skillDisplay = c.skill_name || SKILL_DISPLAY_NAMES[c.skill] || "Digital Skills";

    leaderboardEntries.push({
      user_id: c.student_id || c.id,
      userId: c.student_id || c.id,
      id: c.kr8_id,
      kr8_id: c.kr8_id,
      name: c.student_name || "KR8 Graduate",
      avatar: null,
      skill: c.skill || "graphic",
      skillName: skillDisplay,
      skillDisplay,
      skills: [c.skill || "graphic"],
      multiSkillCount: 1,
      graduated: true,
      isExcellent: isExcellence,
      distinction: isExcellence ? "Excellence" : "Completed",
      certTier: c.tier || "Professionalism",
      certRecognition: comment,
      hasGoodComment: Boolean(comment),
      commendation: comment,
      commentsCount: comment ? 1 : 0,
      submissions: 6,
      submissionsCount: 6,
      attendanceAccepted: 12,
      attendanceCount: 12,
      referrals: 0,
      referralsCount: 0,
      tasksCount: 1,
      points,
      created_at: c.issued_at,
    });
  }

  // Merge verified scholars & graduates from store.ts if not already in seenKr8Ids
  try {
    const { getStudents, getCertificates } = await import("@/kr8/data/store");
    const storeStudents = getStudents();
    const storeCerts = getCertificates();
    const storeCertsByStudent = new Map<string, any[]>();
    for (const sc of storeCerts) {
      if (sc.status === "withdrawn") continue;
      const k = String(sc.studentId || "").toUpperCase();
      if (!k) continue;
      const arr = storeCertsByStudent.get(k) || [];
      arr.push(sc);
      storeCertsByStudent.set(k, arr);
    }

    for (const s of storeStudents) {
      const kr8Upper = String(s.id || "").toUpperCase();
      if (!kr8Upper || seenKr8Ids.has(kr8Upper)) continue;
      seenKr8Ids.add(kr8Upper);

      const sCerts = storeCertsByStudent.get(kr8Upper) || [];
      const isGrad = Boolean(s.graduated || sCerts.length > 0);
      const tier = sCerts[0]?.tier || s.certTier || (isGrad ? "Professionalism" : null);
      const rec = sCerts[0]?.additionalNotes || s.certRecognition || s.verifyRemark || "";
      const isExc = isGrad && (tier === "Professionalism" || hasPositiveComment(rec));
      const hasComment = isGrad && hasPositiveComment(rec);
      const multiCount = Math.max(1, sCerts.length);
      const subs = Number(s.submissions || 0);
      const att = Number(s.attendanceAccepted || 0);
      const refs = Number(s.referrals || 0);
      const calcPts =
        50 +
        (isGrad ? (isExc ? 180 : 110) : 0) +
        (hasComment ? 45 : 0) +
        (multiCount > 1 ? (multiCount - 1) * 85 : 0) +
        subs * 25 +
        att * 15 +
        refs * 30;
      const finalPts = Math.max(Number(s.points || 0), calcPts);
      const sDisplay = SKILL_DISPLAY_NAMES[s.skill || "graphic"] || "Graphic Design";

      leaderboardEntries.push({
        user_id: s.id,
        userId: s.id,
        id: s.id,
        kr8_id: s.id,
        name: s.name,
        avatar: s.avatar || null,
        skill: s.skill || "graphic",
        skillName: sDisplay,
        skillDisplay: sDisplay,
        skills: [s.skill || "graphic"],
        multiSkillCount: multiCount,
        graduated: isGrad,
        isExcellent: isExc,
        distinction: isGrad ? (isExc ? "Excellence" : "Completed") : null,
        certTier: tier,
        certRecognition: rec || null,
        hasGoodComment: hasComment,
        commendation: rec || null,
        commentsCount: hasComment ? 1 : 0,
        submissions: subs,
        submissionsCount: subs,
        attendanceAccepted: att,
        attendanceCount: att,
        referrals: refs,
        referralsCount: refs,
        tasksCount: 1,
        points: finalPts,
        created_at: new Date(s.joined || Date.now()).toISOString(),
      });
    }
  } catch {}

  // Sort Leaderboard: highest points first, then Excellence > Completed > Double Skill > Submissions > Attendance
  leaderboardEntries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.distinction === "Excellence" && b.distinction !== "Excellence") return -1;
    if (b.distinction === "Excellence" && a.distinction !== "Excellence") return 1;
    if (a.graduated !== b.graduated) return a.graduated ? -1 : 1;
    if (b.multiSkillCount !== a.multiSkillCount) return b.multiSkillCount - a.multiSkillCount;
    return String(a.name).localeCompare(String(b.name));
  });

  const rankedLeaderboard = leaderboardEntries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));

  // Build Real-Time Live Feed (most recent activities across the database, sorted newest first)
  const profileNameMap = new Map<string, { name: string; avatar?: string; skill?: string; kr8_id?: string }>();
  for (const p of profiles) {
    profileNameMap.set(p.id, {
      name: p.name,
      avatar: p.avatar,
      skill: SKILL_DISPLAY_NAMES[p.skill] || p.skill || "KR8 Academy",
      kr8_id: p.kr8_id,
    });
  }

  const liveFeedItems: any[] = [];

  // 1. Recent Graduations / Certificates
  for (const c of certs.slice(0, 15)) {
    const isExc = c.tier === "Professionalism";
    liveFeedItems.push({
      id: `cert-${c.id}`,
      kind: "graduation",
      name: c.student_name,
      kr8_id: c.kr8_id,
      avatar: profileNameMap.get(c.student_id)?.avatar || null,
      skill: c.skill_name || SKILL_DISPLAY_NAMES[c.skill] || "KR8 Academy",
      customAction: isExc
        ? `graduated with Excellence (Certificate of Professionalism)${c.additional_notes ? ` — "${c.additional_notes}"` : ""} 🎓`
        : `graduated and earned the Certificate of Completion 🎓`,
      ts: new Date(c.issued_at || Date.now()).getTime(),
    });
  }

  // 2. Recent Assignment & Attendance Submissions
  for (const sub of attendanceSubs.slice(0, 15)) {
    const topicLower = (sub.class_topic || "").toLowerCase();
    const isAssign = topicLower.includes("assign") || topicLower.includes("project") || topicLower.includes("drill");
    liveFeedItems.push({
      id: `sub-${sub.id}`,
      kind: isAssign ? "submission" : "attendance",
      name: sub.student_name || profileNameMap.get(sub.user_id)?.name || "KR8 Scholar",
      kr8_id: sub.kr8_id,
      avatar: profileNameMap.get(sub.user_id)?.avatar || null,
      skill: SKILL_DISPLAY_NAMES[sub.skill] || sub.skill || "KR8 Academy",
      customAction:
        sub.status === "accepted"
          ? `had ${isAssign ? "assignment" : "class attendance"} "${sub.class_topic || "Cohort Drill"}" approved (+${sub.points_awarded || (isAssign ? 25 : 10)} XP) ✅`
          : `submitted ${isAssign ? "assignment" : "attendance"} for "${sub.class_topic || "Cohort Session"}" 📝`,
      ts: new Date(sub.created_at || Date.now()).getTime(),
    });
  }

  // 3. Recent Student Registrations
  for (const p of profiles.slice(0, 20)) {
    const skillName = SKILL_DISPLAY_NAMES[p.skill] || p.skill || "KR8 Academy";
    liveFeedItems.push({
      id: `reg-${p.id}`,
      kind: "registration",
      name: p.name,
      kr8_id: p.kr8_id,
      avatar: p.avatar || null,
      skill: skillName,
      customAction: `enrolled in ${skillName} Cohort 🚀`,
      ts: new Date(p.created_at || Date.now()).getTime(),
    });
  }

  // 4. Recent XP Ledger Awards
  for (const l of ledger.slice(0, 12)) {
    if (Number(l.points_change) <= 0) continue;
    const actor = profileNameMap.get(l.user_id);
    liveFeedItems.push({
      id: `xp-${l.id}`,
      kind: "attendance",
      name: actor?.name || l.kr8_id || "KR8 Scholar",
      kr8_id: l.kr8_id,
      avatar: actor?.avatar || null,
      skill: actor?.skill || "KR8 Academy",
      customAction: `earned +${l.points_change} XP — ${l.reason || "Consistency Milestone"} ⚡`,
      ts: new Date(l.created_at || Date.now()).getTime(),
    });
  }

  // Fallback / merge recent activities from store.ts if liveFeedItems has fewer than 15 items
  if (liveFeedItems.length < 15) {
    try {
      const { getActivityFeed } = await import("@/kr8/data/store");
      const localActs = getActivityFeed();
      localActs.forEach((act: any, idx: number) => {
        liveFeedItems.push({
          id: act.id || `local-act-${idx}`,
          kind: "activity",
          type: "activity",
          who: act.who,
          name: act.who,
          kr8_id: undefined,
          avatar: act.avatar || null,
          skill: "KR8 Academy",
          action: act.action,
          customAction: act.action,
          when: Date.now() - idx * 300000,
          ts: Date.now() - idx * 300000,
        });
      });
    } catch {}
  }

  const normalizedFeed = liveFeedItems
    .map((item) => ({
      ...item,
      who: item.who || item.name || "KR8 Scholar",
      action: item.action || item.customAction || "completed a milestone in KR8 Academy",
      when: item.when || item.ts || Date.now(),
      type: item.type || item.kind || "activity",
    }))
    .sort((a, b) => Number(b.ts || b.when || 0) - Number(a.ts || a.when || 0))
    .slice(0, 35);

  const gradCount = rankedLeaderboard.filter((e) => e.graduated).length;
  const multiSkillCountTotal = rankedLeaderboard.filter((e) => (e.multiSkillCount || 1) > 1).length;

  return {
    ok: true,
    leaderboard: rankedLeaderboard,
    feed: normalizedFeed,
    liveFeed: normalizedFeed,
    stats: {
      totalStudents: rankedLeaderboard.length,
      graduatedStudents: gradCount,
      totalCertificates: Math.max(certs.length, gradCount),
      multiSkillStudents: multiSkillCountTotal,
    },
    counts: {
      totalStudents: rankedLeaderboard.length,
      graduatedCount: gradCount,
      certificatesCount: Math.max(certs.length, gradCount),
    },
  };
});

const credentialsInputSchema = z.object({
  userId: z.string().optional(),
  kr8Id: z.string().optional(),
  email: z.string().optional(),
});

export const getStudentCredentials = createServerFn({ method: "POST" })
  .inputValidator((d) => credentialsInputSchema.parse(d))
  .handler(async ({ data }) => {
    await reconcileDatabaseState(false);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let profile: any = null;
    if (data.userId) {
      const { data: p } = await supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle();
      if (p) profile = p;
    }
    if (!profile && data.kr8Id) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .ilike("kr8_id", data.kr8Id.trim())
        .maybeSingle();
      if (p) profile = p;
    }
    if (!profile && data.email) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .ilike("email", data.email.trim())
        .maybeSingle();
      if (p) profile = p;
    }

    const certsList: any[] = [];
    const seenCodes = new Set<string>();

    if (profile?.id || data.userId) {
      const uid = profile?.id || data.userId;
      const { data: byUid } = await supabaseAdmin
        .from("certificates")
        .select("*")
        .eq("student_id", uid)
        .order("issued_at", { ascending: false });
      for (const c of byUid || []) {
        if (!seenCodes.has(c.certificate_code)) {
          seenCodes.add(c.certificate_code);
          certsList.push(c);
        }
      }
    }

    const kr8ToQuery = profile?.kr8_id || data.kr8Id;
    if (kr8ToQuery) {
      const { data: byKr8 } = await supabaseAdmin
        .from("certificates")
        .select("*")
        .ilike("kr8_id", kr8ToQuery.trim())
        .order("issued_at", { ascending: false });
      for (const c of byKr8 || []) {
        if (!seenCodes.has(c.certificate_code)) {
          seenCodes.add(c.certificate_code);
          certsList.push(c);
        }
      }
    }

    // If profile is graduated and has no certificate row yet, synthesize one
    if (profile?.graduated && certsList.length === 0) {
      const skillKey = profile.skill || "graphic";
      const skillName = SKILL_DISPLAY_NAMES[skillKey] || skillKey;
      const tier = profile.cert_tier === "Completion" ? "Completion" : "Professionalism";
      certsList.push({
        id: `synth-${profile.id}`,
        certificate_code: `CERT-KR8-${profile.kr8_id}-${skillKey.toUpperCase()}`,
        student_id: profile.id,
        kr8_id: profile.kr8_id,
        student_name: profile.name,
        formatted_name: String(profile.name || "").toUpperCase(),
        skill: skillKey,
        skill_name: skillName,
        tier,
        template_url: `/certificates/reusable_${tier.toLowerCase()}.png`,
        achievement_text:
          tier === "Professionalism"
            ? "demonstrating excellence and proficiency in turning client requests into client satisfaction."
            : "gaining hands-on experience in turning client requests into finished designs.",
        additional_notes: profile.cert_recognition || null,
        issued_at: profile.created_at || new Date().toISOString(),
        status: "active",
      });
    }

    let enrollments: any[] = [];
    if (profile?.id) {
      const { data: enr } = await supabaseAdmin
        .from("enrollments")
        .select("*")
        .eq("user_id", profile.id);
      enrollments = enr || [];
    }

    return {
      profile,
      certificates: certsList,
      enrollments,
    };
  });

const onboardingSchema = z.object({
  userId: z.string().min(1),
  whatsappJoined: z.boolean(),
  onboardingSkipped: z.boolean(),
});

export const recordStudentOnboardingStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => onboardingSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Update profiles if columns exist
    try {
      await supabaseAdmin
        .from("profiles")
        .update({
          whatsapp_joined: data.whatsappJoined,
          whatsapp_joined_at: data.whatsappJoined ? new Date().toISOString() : null,
          onboarding_skipped: data.onboardingSkipped,
        } as any)
        .eq("id", data.userId);
    } catch {}

    // 2. Always persist in Supabase Auth user_metadata (works even without migration 0008)
    try {
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      const prevMeta = existingUser?.user?.user_metadata || {};
      await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        user_metadata: {
          ...prevMeta,
          whatsapp_joined: data.whatsappJoined,
          onboarding_skipped: data.onboardingSkipped,
          whatsapp_joined_at: data.whatsappJoined ? new Date().toISOString() : prevMeta.whatsapp_joined_at,
        },
      });
    } catch {}

    // 3. Log activity for real-time leaderboard & feed
    if (data.whatsappJoined) {
      try {
        await supabaseAdmin.from("activity_log").insert({
          actor_id: data.userId,
          action: "whatsapp_group_joined",
          target: "WhatsApp Learning Group",
          details: { whatsapp_joined: true },
        });
      } catch {}
    }

    return { ok: true };
  });

/**
 * Retrieves all Admin-controllable site state from Supabase (`site_content`, `agency_portfolio`, `skill_settings`, `team_members`, `announcements`, `testimonials`, `site_settings`).
 */
export const getAdminSiteState = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [
    siteContentRes,
    portfolioRes,
    skillsRes,
    teamRes,
    announcementsRes,
    testimonialsRes,
    settingsRes,
  ] = await Promise.all([
    supabaseAdmin.from("site_content").select("*"),
    supabaseAdmin.from("agency_portfolio").select("*").order("sort", { ascending: true }),
    supabaseAdmin.from("skill_settings").select("*"),
    supabaseAdmin.from("team_members").select("*").order("sort", { ascending: true }),
    supabaseAdmin.from("announcements").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("testimonials").select("*").order("sort", { ascending: true }),
    supabaseAdmin.from("site_settings").select("*"),
  ]);

  // Alsofix any stale Google Drive team_members image URLs in DB automatically
  const teamRows = teamRes.data || [];
  for (const row of teamRows) {
    const img = String(row.image_url || "");
    if (img.includes("drive.google.com") || img.includes("lh3.googleusercontent.com")) {
      let fixed = img;
      const lowerName = String(row.name || "").toLowerCase();
      if (lowerName.includes("timfire") || lowerName.includes("kenneth") || img.includes("1TSZrdT2xXpZj6D8_t9PGhu1dSamBNr7C")) {
        fixed = "/founder_timfire_wide.jpg";
      } else if (lowerName.includes("stevenson") || lowerName.includes("motionverse") || img.includes("1GFIv8Ho101udn2IbSiz5Zq8G92XJn2AU")) {
        fixed = "/team/stevenson.jpg";
      } else if (lowerName.includes("daniel") || lowerName.includes("creative") || img.includes("1Ssje7WtVFMd8TZxMfrex1S0lKG6p_Wp9")) {
        fixed = "/team/daniel.jpg";
      }
      if (fixed !== img) {
        try {
          await supabaseAdmin.from("team_members").update({ image_url: fixed }).eq("id", row.id);
          row.image_url = fixed;
        } catch {}
      }
    }
  }

  return {
    ok: true,
    siteContent: siteContentRes.data || [],
    agencyPortfolio: portfolioRes.data || [],
    skillSettings: skillsRes.data || [],
    teamMembers: teamRows,
    announcements: announcementsRes.data || [],
    testimonials: testimonialsRes.data || [],
    siteSettings: settingsRes.data || [],
  };
});

const saveAdminStateSchema = z.object({
  section: z.string().min(1),
  key: z.string().min(1),
  value: z.any(),
});

/**
 * Persists any Admin Dashboard modification into Supabase (`site_content` + corresponding normalized tables).
 */
export const saveAdminSiteState = createServerFn({ method: "POST" })
  .inputValidator((d) => saveAdminStateSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Always save into site_content JSONB store (page=section, key=key)
    try {
      await supabaseAdmin.from("site_content").upsert(
        {
          page: data.section,
          key: data.key,
          value: data.value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "page,key" }
      );
    } catch (e) {
      console.warn("[saveAdminSiteState] site_content upsert warning:", e);
    }

    // 2. Also sync into normalized tables based on section/key
    try {
      if (data.section === "agency" && data.key === "portfolio_items" && Array.isArray(data.value)) {
        for (let i = 0; i < data.value.length; i++) {
          const item = data.value[i];
          if (!item || !item.title) continue;
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.id || ""));
          const payload: any = {
            title: item.title,
            client: item.client || item.title,
            image_url: item.img || item.image_url || "",
            link: item.link || null,
            description: item.description || "",
            sort: i + 1,
            visible: item.visible !== false,
            updated_at: new Date().toISOString(),
          };
          if (isUuid) {
            payload.id = item.id;
            await supabaseAdmin.from("agency_portfolio").upsert(payload);
          } else {
            const { data: existing } = await supabaseAdmin
              .from("agency_portfolio")
              .select("id")
              .eq("title", item.title)
              .maybeSingle();
            if (existing?.id) {
              await supabaseAdmin.from("agency_portfolio").update(payload).eq("id", existing.id);
            } else {
              await supabaseAdmin.from("agency_portfolio").insert(payload);
            }
          }
        }
      } else if (data.section === "skills" && data.key === "skill_settings" && data.value && typeof data.value === "object") {
        for (const [skillKey, cfg] of Object.entries(data.value as Record<string, any>)) {
          if (!cfg) continue;
          await supabaseAdmin
            .from("skill_settings")
            .update({
              registration_open: Boolean(cfg.registrationOpen ?? cfg.registration_open ?? true),
              whatsapp_url: cfg.whatsapp || cfg.whatsapp_url || undefined,
              instructor_name: cfg.instructor?.name || cfg.instructor_name || undefined,
              instructor_bio: cfg.instructor?.bio || cfg.instructor_bio || undefined,
              instructor_photo: cfg.instructor?.photo || cfg.instructor_photo || undefined,
              curriculum: cfg.curriculum || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("skill_key", skillKey);
        }
      } else if (data.section === "settings" && data.value && typeof data.value === "object") {
        await supabaseAdmin.from("site_settings").upsert(
          {
            key: data.key,
            value: data.value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      }
    } catch (normErr) {
      console.warn("[saveAdminSiteState] normalized table sync warning:", normErr);
    }

    return { ok: true };
  });

const adminProfileUpdateSchema = z.object({
  kr8Id: z.string().min(1),
  updates: z.record(z.any()),
});

/**
 * Allows Admin Dashboard to update a student/user record in `profiles` directly.
 */
export const adminUpdateStudentProfile = createServerFn({ method: "POST" })
  .inputValidator((d) => adminProfileUpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profRows } = await supabaseAdmin
      .from("profiles")
      .select("id, kr8_id")
      .ilike("kr8_id", data.kr8Id.trim())
      .limit(1);
    const prof = profRows?.[0];
    if (!prof) return { ok: false, error: "Profile not found in DB" };

    const dbPatch: Record<string, any> = { updated_at: new Date().toISOString() };
    const u = data.updates;
    if (u.name !== undefined) dbPatch.name = u.name;
    if (u.skill !== undefined) dbPatch.skill = u.skill;
    if (u.points !== undefined) dbPatch.points = Number(u.points);
    if (u.graduated !== undefined) dbPatch.graduated = Boolean(u.graduated);
    if (u.certTier !== undefined) dbPatch.cert_tier = u.certTier;
    if (u.certRecognition !== undefined) dbPatch.cert_recognition = u.certRecognition;
    if (u.verifyRemark !== undefined) dbPatch.verify_remark = u.verifyRemark;
    if (u.attendanceAccepted !== undefined) dbPatch.attendance_accepted = Number(u.attendanceAccepted);
    if (u.submissions !== undefined) dbPatch.submissions = Number(u.submissions);
    if (u.referrals !== undefined) dbPatch.referrals = Number(u.referrals);
    if (u.bio !== undefined) dbPatch.bio = u.bio;
    if (u.avatar !== undefined) dbPatch.avatar = u.avatar;
    if (u.isSuspended !== undefined) dbPatch.is_suspended = Boolean(u.isSuspended);

    await supabaseAdmin.from("profiles").update(dbPatch).eq("id", prof.id);
    return { ok: true, id: prof.id };
  });

