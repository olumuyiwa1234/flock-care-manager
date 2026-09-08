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
import { Plus, Search, X } from "lucide-react";

export type ParentSelection = { id: string; name: string };
export type ParentSelections = ParentSelection[];

const MAX_PARENTS = 2;

export function ParentPicker({
  value,
  onChange,
}: {
  value: ParentSelections;
  onChange: (v: ParentSelections) => void;
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

  const canAddMore = value.length < MAX_PARENTS;

  return (
    <div className="space-y-2">
      {value.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <div className="flex-1 rounded-md border px-3 py-2 text-sm font-medium">
            {p.name}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${p.name}`}
            onClick={() => onChange(value.filter((v) => v.id !== p.id))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}

      {canAddMore && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-start font-normal">
              {value.length === 0 ? (
                <>
                  <Search className="mr-2 size-4 shrink-0" />
                  Search members by name
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4 shrink-0" />
                  Add second parent
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {value.length === 0 ? "Find parent" : "Find second parent"}
              </DialogTitle>
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
              {results
                .filter((m) => !value.some((v) => v.id === m.id))
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChange([...value, { id: m.id, name: m.full_name }]);
                      setOpen(false);
                      setTerm("");
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
      )}
    </div>
  );
}
