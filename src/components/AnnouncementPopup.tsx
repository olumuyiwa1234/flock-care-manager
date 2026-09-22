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
  expires_at: string | null;
};

/** Key used to remember, for this sign-in session only, which blasts were closed. */
const SESSION_KEY = "shepherd-closed-announcements";

/** Read the list of announcements the user closed during this session. */
function closedThisSession(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Pops up the newest active announcement.
 * It keeps showing until the time the sender set, and closing it only hides it
 * for the current session — signing in again brings it back while it is still live.
 */
export function AnnouncementPopup() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  // Announcements closed during this session (kept in state so the popup re-renders).
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    setClosed(closedThisSession());
  }, []);

  const { data } = useQuery({
    queryKey: ["active-announcement", auth?.userId ?? "anon"],
    enabled: Boolean(auth?.userId),
    staleTime: 60_000,
    queryFn: async (): Promise<AnnouncementRow | null> => {
      const { data: rows } = await supabase
        .from("announcements")
        .select("id, title, body, author_name, created_at, expires_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);
      const now = Date.now();
      // Only keep blasts whose display window has not run out yet.
      return (
        ((rows ?? []) as AnnouncementRow[]).find(
          (r) => !r.expires_at || new Date(r.expires_at).getTime() > now,
        ) ?? null
      );
    },
  });

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (data && !closed.includes(data.id)) setVisible(true);
  }, [data?.id, closed]);

  if (!data || !visible || closed.includes(data.id)) return null;

  // Closing hides the blast for now; it returns on the next sign-in while still live.
  async function dismiss() {
    if (!data) return;
    setClosing(true);
    setVisible(false);
    const next = [...closedThisSession(), data.id];
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setClosed(next);
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
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(data.created_at)}</p>
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
