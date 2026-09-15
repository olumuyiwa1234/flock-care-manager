import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { FullPageLoader } from "./components/GlobalLoader";

export const getRouter = () => {
  // Shared data cache. Sensible defaults keep the app feeling fast:
  // - staleTime: reuse data for a minute instead of refetching on every visit
  // - refetchOnWindowFocus off: no surprise reloads when switching apps
  // - retry once: a single quick retry instead of long repeated waits
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start loading a page as soon as the user shows intent (hover/touch),
    // so taps feel instant. Preloaded data stays fresh for 30 seconds.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    // Show a spinner quickly instead of leaving the screen blank.
    defaultPendingMs: 200,
    defaultPendingMinMs: 300,
    defaultPendingComponent: () => <FullPageLoader />,
  });

  return router;
};
