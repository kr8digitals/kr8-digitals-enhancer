import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "./router-shim";
import { AuthProvider } from "./context/AuthContext";
import { LiveStreamProvider } from "./context/LiveStreamContext";
import { initSupabaseSync } from "./lib/supabaseSync";
import { initMindsetShiftSync } from "./lib/mindsetShiftSync";
import Layout from "./components/Layout";

const Home = lazy(() => import("./pages/Home"));
const Academy = lazy(() => import("./pages/Academy"));
const Tribe = lazy(() => import("./pages/Tribe"));
const Agency = lazy(() => import("./pages/Agency"));
const AIPage = lazy(() => import("./pages/AIPage"));
const Blog = lazy(() => import("./pages/Blog"));
const About = lazy(() => import("./pages/About"));
const PartnerPage = lazy(() => import("./pages/PartnerPage"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Verify = lazy(() => import("./pages/Verify"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AttendanceReview = lazy(() => import("./pages/AttendanceReview"));
const Settings = lazy(() => import("./pages/Settings"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LivePage = lazy(() => import("./pages/LivePage"));
const Gallery = lazy(() => import("./pages/Gallery"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const WaitlistPage = lazy(() => import("./pages/WaitlistPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const MindsetShiftPage = lazy(() => import("./pages/MindsetShiftPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const GoRedirect = lazy(() => import("./pages/GoRedirect"));

function Loading() {
  return <div className="min-h-screen bg-[#0d0015] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" /></div>;
}

export default function App() {
  useEffect(() => {
    initSupabaseSync();
    initMindsetShiftSync();
  }, []);

  return (
    <AuthProvider>
      <LiveStreamProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/waitlist" element={<WaitlistPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/signup" element={<RegisterPage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/login" element={<SignInPage />} />
                <Route path="/live" element={<LivePage />} />
                <Route path="/academy" element={<Academy />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tribe" element={<Tribe />} />
                <Route path="/agency" element={<Agency />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/ai" element={<AIPage />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/about" element={<About />} />
                <Route path="/mindset-shift" element={<MindsetShiftPage />} />
                <Route path="/partner" element={<PartnerPage />} />
                <Route path="/partner-with-us" element={<PartnerPage />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/verify" element={<Verify />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/attendance-review" element={<AttendanceReview />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/go/:slug" element={<GoRedirect />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </LiveStreamProvider>
    </AuthProvider>
  );
}
