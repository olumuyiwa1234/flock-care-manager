import { useState } from "react";
import { CalendarIcon, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(month: number) {
  // Use a leap year so February offers 29 days
  return new Date(2024, month, 0).getDate();
}

interface Props {
  month: number | null;
  day: number | null;
  onChange: (month: number | null, day: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}

export function MonthDayPicker({ month, day, onChange, placeholder = "Pick a date" }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"month" | "day">("month");
  const [selMonth, setSelMonth] = useState<number | null>(month);

  const label = month && day ? `${MONTHS[month - 1]} ${day}` : placeholder;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setView(month ? "day" : "month"); setSelMonth(month); } }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !(month && day) && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 pointer-events-auto" align="start">
        {view === "month" ? (
          <div className="grid grid-cols-3 gap-1.5 w-[264px]">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => { setSelMonth(i + 1); setView("day"); }}
                className={cn(
                  "rounded-md px-2 py-2 text-xs font-medium hover:bg-accent",
                  selMonth === i + 1 && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        ) : (
          <div className="w-[280px]">
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setView("month")} className="p-1 rounded hover:bg-accent" aria-label="Back to months">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">{selMonth ? MONTHS[selMonth - 1] : ""}</span>
              <span className="w-6" />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: selMonth ? new Date(2024, selMonth - 1, 1).getDay() : 0 }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {selMonth && Array.from({ length: daysInMonth(selMonth) }).map((_, i) => {
                const d = i + 1;
                const selected = month === selMonth && day === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { onChange(selMonth, d); setOpen(false); }}
                    className={cn(
                      "rounded-md py-1.5 text-xs hover:bg-accent",
                      selected && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
