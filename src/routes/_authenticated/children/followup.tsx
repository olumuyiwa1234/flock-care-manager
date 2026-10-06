import { createFileRoute } from "@tanstack/react-router";
import { YouthFollowUp } from "@/components/YouthFollowUp";

/** Children's missed-Sunday sub-tile, separate from the adult follow-up list. */
export const Route = createFileRoute("/_authenticated/children/followup")({
  head: () => ({ meta: [
    { title: "Children Follow-up — Shepherd" },
    { name: "description", content: "Children who missed two or more consecutive Sunday services." },
    { property: "og:title", content: "Children Follow-up — Shepherd" },
    { property: "og:description", content: "Review children's missed Sunday services and record pastoral contacts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <YouthFollowUp group="children" />,
});