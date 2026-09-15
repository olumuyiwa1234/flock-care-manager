import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * GlobalLoader
 * A slim progress bar pinned to the very top of the screen plus a small
 * "Working…" pill. It appears whenever the app is doing something the user
 * is waiting on: loading data, saving data, or moving between pages.
 * This gives clear feedback instead of a screen that looks frozen.
 */
export function GlobalLoader() {
  // Number of data reads currently in flight (React Query).
  const fetching = useIsFetching();
  // Number of writes currently in flight (React Query mutations).
  const mutating = useIsMutating();
  // True while the router is loading the next page.
  const navigating = useRouterState({ select: (s) => s.status === "pending" });

  const active = fetching > 0 || mutating > 0 || navigating;

  // Small delay before showing, so very fast operations don't cause a flash.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 150);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100]" aria-live="polite">
      {/* Animated progress stripe */}
      <div className="h-0.5 w-full overflow-hidden bg-primary/15">
        <div className="h-full w-1/3 animate-[shepherd-progress_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      {/* Screen-reader friendly status text */}
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * FullPageLoader
 * Used while a whole page is still preparing, so users see a spinner
 * rather than a blank white screen.
 */
export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
