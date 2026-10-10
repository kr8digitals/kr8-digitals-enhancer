import { supabase } from "@/integrations/supabase/client";

export async function getSiteContent(page?: string): Promise<Record<string, any>> {
  try {
    let q = supabase.from('site_content').select('page,key,value');
    if (page) q = q.eq('page', page);
    const { data } = await q;
    if (!data) return {};
    const map: Record<string, any> = {};
    data.forEach((r: any) => {
      const k = page ? r.key : `${r.page}:${r.key}`;
      map[k] = r.value;
    });
    return map;
  } catch {
    return {};
  }
}

export async function getSiteContentByPage(page: string): Promise<Record<string, any>> {
  try {
    const { data } = await supabase.from('site_content').select('key,value').eq('page', page);
    if (!data) return {};
    const map: Record<string, any> = {};
    data.forEach((r: any) => map[r.key] = r.value);
    return map;
  } catch {
    return {};
  }
}
