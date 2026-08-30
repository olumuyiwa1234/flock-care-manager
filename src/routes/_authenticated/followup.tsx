import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CONTACT_METHODS, SITUATIONS, formatDate, todayISO } from "@/lib/shepherd";
import { useMembers } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/followup")({
  head: () => ({
    meta: [
      { title: "Follow-up — Shepherd" },
      { name: "description", content: "Record calls, SMS, WhatsApp messages and home visits for pastoral follow-up." },
      { property: "og:title", content: "Follow-up — Shepherd" },
      { property: "og:description", content: "Log pastoral care contacts and notes for members." },
    ],
  }),
  component: FollowUp,
});

function FollowUp() {
  const { auth, isFloor } = useAuth();
  const queryClient = useQueryClient();
  const { data: members = [] } = useMembers();
  const [memberId, setMemberId] = useState("");
  const [method, setMethod] = useState<string>(CONTACT_METHODS[0]);
  const [situation, setSituation] = useState<string>("None");
  const [contactedOn, setContactedOn] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useQuery({
    queryKey: ["follow-ups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*, members(full_name, member_code)")
        .order("contacted_on", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isFloor) {
    return (
      <AppShell title="Follow-up">
        <EmptyState title="Not available for floor members" hint="Church leaders record follow-up here." />
      </AppShell>
    );
  }

  async function save() {
    if (!memberId) {
      toast.error("Choose a member first");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("follow_ups").insert({
      member_id: memberId,
      contact_method: method,
      situation,
      contacted_on: contactedOn,
      notes: notes || null,
      created_by: auth?.userId ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes("");
    toast.success("Follow-up recorded");
    await queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
  }

  return (
    <AppShell title="Follow-up" subtitle="Pastoral care log">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div>
          <Label>Member</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name} · {m.member_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Contact method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_METHODS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Situation</Label>
            <Select value={situation} onValueChange={setSituation}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUATIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Date contacted</Label>
          <Input
            type="date"
            className="mt-1"
            value={contactedOn}
            onChange={(e) => setContactedOn(e.target.value)}
          />
        </div>

        <div>
          <Label>Follow-up notes</Label>
          <Textarea
            className="mt-1"
            rows={3}
            placeholder="What was discussed?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Record follow-up"}
        </Button>
      </div>

      <h2 className="mb-3 mt-6 text-base font-semibold">Recent follow-ups</h2>
      {(list.data ?? []).length === 0 ? (
        <EmptyState title="No follow-ups recorded yet" />
      ) : (
        <ul className="space-y-2">
          {(list.data ?? []).map((f: any) => (
            <li key={f.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.members?.full_name ?? "Member"}</span>
                <span className="text-xs text-muted-foreground">{formatDate(f.contacted_on)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {f.contact_method}
                {f.situation && f.situation !== "None" ? ` · ${f.situation}` : ""}
              </p>
              {f.notes && <p className="mt-1 text-muted-foreground">{f.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
