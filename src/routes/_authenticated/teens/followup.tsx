import { createFileRoute } from "@tanstack/react-router";
import { YouthFollowUp } from "@/components/YouthFollowUp";

/** Teenagers' missed-Sunday sub-tile, separate from the adult follow-up list. */
export const Route = createFileRoute("/_authenticated/teens/followup")({
  head: () => ({ meta: [
    { title: "Teens Follow-up — Shepherd" },
    { name: "description", content: "Teenagers who missed two or more consecutive Sunday services." },
    { property: "og:title", content: "Teens Follow-up — Shepherd" },
    { property: "og:description", content: "Review teenagers' missed Sunday services and record pastoral contacts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <YouthFollowUp group="teens" />,
});