import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarCheck, HeartHandshake, Users } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shepherd — Church Member & Attendance App" },
      {
        name: "description",
        content:
          "Shepherd is a simple mobile app for churches: check members in, track attendance, spot absentees and follow up with care.",
      },
      { property: "og:title", content: "Shepherd — Church Member & Attendance App" },
      {
        property: "og:description",
        content:
          "Check members in, track attendance, spot absentees and follow up with care.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { auth, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && auth) navigate({ to: "/home", replace: true });
  }, [auth, loading, navigate]);

  return (
    <div className="min-h-screen bg-sky-gradient text-primary-foreground">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-between px-6 py-12">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] opacity-70">Shepherd</p>
          <h1 className="mt-6 text-balance-tight text-4xl font-semibold leading-tight">
            Care for every member, week after week.
          </h1>
          <p className="mt-4 text-base opacity-85">
            Check members in on arrival, keep attendance records accurate, and know exactly who
            needs a call before another Sunday passes.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: CalendarCheck, text: "One-tap check-in at the church premises" },
              { icon: Users, text: "A complete, searchable member database" },
              { icon: HeartHandshake, text: "Absentee alerts and follow-up records" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary-foreground/15">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm opacity-90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 space-y-3">
          <Button asChild size="lg" variant="secondary" className="w-full text-base">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
