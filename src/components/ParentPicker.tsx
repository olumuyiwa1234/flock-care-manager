import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, X } from "lucide-react";

export type ParentSelection = { id: string; name: string } | null;

export function ParentPicker({
  value,
  onChange,
}: {
  value: ParentSelection;
  onChange: (v: ParentSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["parent-search", term],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("members")
        .select("id, full_name, phone, department")
        .order("full_name")
        .limit(25);
      if (term.trim()) q = q.ilike("full_name", `%${term.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="flex-1 justify-start font-normal">
            <Search className="mr-2 size-4 shrink-0" />
            {value ? value.name : "Search members by name"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Find parent</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Type a name…"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {isFetching && <p className="p-2 text-sm text-muted-foreground">Searching…</p>}
            {!isFetching && results.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">No members found.</p>
            )}
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange({ id: m.id, name: m.full_name });
                  setOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="font-medium">{m.full_name}</span>
                {m.phone && (
                  <span className="ml-2 text-xs text-muted-foreground">{m.phone}</span>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear parent"
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
