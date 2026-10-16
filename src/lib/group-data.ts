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

// All contributions for one member across every month (My Ajo view).
export function useMemberHistory(groupId: string, memberId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-contribs", groupId, memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const r = await supabase
        .from("contributions")
        .select("*")
        .eq("group_id", groupId)
        .eq("member_id", memberId!)
        .order("month", { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    if (!memberId) return;
    const ch = supabase
      .channel(`my-contribs-${groupId}-${memberId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contributions", filter: `group_id=eq.${groupId}` }, () =>
        qc.invalidateQueries({ queryKey: ["my-contribs", groupId, memberId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [groupId, memberId, qc]);

  return q;
}
