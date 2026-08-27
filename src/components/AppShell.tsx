import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({
  title,
  subtitle,
  children,
  back = "/home",
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: string | false;
  action?: ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-sky-gradient px-4 pb-5 pt-5 text-primary-foreground shadow-tile">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {back !== false && (
            <button
              type="button"
              aria-label="Go back"
              onClick={() => {
                if (typeof back === "string") router.navigate({ to: back });
              }}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-foreground/15 transition hover:bg-primary-foreground/25"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-sm opacity-80">{subtitle}</p>}
          </div>
          {action}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-5">{children}</main>
    </div>
  );
}

export function EmptyState({ title, hint, cta }: { title: string; hint?: string; cta?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {cta && <div className="mt-4 flex justify-center">{cta}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  to,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  to?: string;
  tone?: "default" | "warn" | "good";
}) {
  const toneClass =
    tone === "warn"
      ? "text-destructive"
      : tone === "good"
        ? "text-success"
        : "text-primary";
  const body = (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
  return to ? (
    <Link to={to} className="block transition active:scale-[0.98]">
      {body}
    </Link>
  ) : (
    body
  );
}
