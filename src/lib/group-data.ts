import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentMonth } from "./ajo";

export function useGroup(groupId: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const month = currentMonth();
      const [g, m, c] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
        supabase.from("members").select("*").eq("group_id", groupId).order("payout_order"),
        supabase.from("contributions").select("*").eq("group_id", groupId).eq("month", month),
      ]);
      if (g.error) throw g.error;
      if (m.error) throw m.error;
      if (c.error) throw c.error;
      return { group: g.data, members: m.data ?? [], contributions: c.data ?? [], month };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`contrib-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contributions", filter: `group_id=eq.${groupId}` }, () =>
        qc.invalidateQueries({ queryKey: ["group", groupId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [groupId, qc]);

  return q;
}
