import { useEffect, useState } from "react";
import { useLocation } from "../router-shim";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "../components/ui";

export default function GoRedirect() {
  const location = useLocation();
  const slug = location.pathname.split('/go/')[1]?.split('/')[0] || '';
  const [status, setStatus] = useState("Redirecting...");

  useEffect(() => {
    if (!slug) return;
    const run = async () => {
      try {
        const { data, error } = await supabase.from('links_redirects').select('target_url').eq('slug', slug).eq('is_active', true).maybeSingle();
        if (error || !data) {
          setStatus("Link not found");
          return;
        }
        // Increment clicks via RPC
        try {
          await supabase.rpc('increment_link_click', { p_slug: slug });
        } catch {}
        window.location.href = data.target_url;
      } catch (e: any) {
        setStatus("Failed: " + e.message);
      }
    };
    run();
  }, [slug]);

  return (
    <div className="section-bg min-h-screen flex items-center justify-center px-5">
      <Card className="max-w-md w-full text-center p-8">
        <p className="text-white font-bold">{status}</p>
        <p className="text-xs text-[#8a7ba8] mt-2">If you are not redirected, the link may be invalid.</p>
      </Card>
    </div>
  );
}
