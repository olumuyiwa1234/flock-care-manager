import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { formatDate } from "@/lib/shepherd";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  author_name: string;
  created_at: string;
};

/** Pops up the newest active announcement for every signed-in user until they close it. */
export function AnnouncementPopup() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);

  const { data } = useQuery({
    queryKey: ["active-announcement", auth?.userId ?? "anon"],
    enabled: Boolean(auth?.userId),
    staleTime: 60_000,
    queryFn: async (): Promise<AnnouncementRow | null> => {
      const [{ data: rows }, { data: dismissed }] = await Promise.all([
        supabase
          .from("announcements")
          .select("id, title, body, author_name, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("announcement_dismissals").select("announcement_id"),
      ]);
      const skip = new Set((dismissed ?? []).map((d) => d.announcement_id));
      return ((rows ?? []) as AnnouncementRow[]).find((r) => !skip.has(r.id)) ?? null;
    },
  });

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (data) setVisible(true);
  }, [data?.id]);

  if (!data || !visible) return null;

  async function dismiss() {
    if (!auth || !data) return;
    setClosing(true);
    setVisible(false);
    await supabase
      .from("announcement_dismissals")
      .insert({ announcement_id: data.id, user_id: auth.userId });
    await queryClient.invalidateQueries({ queryKey: ["active-announcement"] });
    setClosing(false);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-3xl border border-border bg-card p-4 shadow-float">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <Megaphone className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{data.title || "Church announcement"}</p>
            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
              {data.body}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {data.author_name || "Church leadership"} · {formatDate(data.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void dismiss()}
            disabled={closing}
            aria-label="Cancel announcement"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
