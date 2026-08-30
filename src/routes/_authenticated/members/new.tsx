import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { MemberForm } from "@/components/MemberForm";

export const Route = createFileRoute("/_authenticated/members/new")({
  head: () => ({
    meta: [
      { title: "Add member — Shepherd" },
      { name: "description", content: "Add a new church member with contact details, department and membership year." },
      { property: "og:title", content: "Add member — Shepherd" },
      { property: "og:description", content: "Add a new member to the church database." },
    ],
  }),
  component: NewMember,
});

function NewMember() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <AppShell title="Add member" subtitle="New member record" back="/members">
      <MemberForm
        submitLabel="Save member"
        onSaved={async (m) => {
          await queryClient.invalidateQueries({ queryKey: ["members"] });
          navigate({ to: "/members/$memberId", params: { memberId: m.id } });
        }}
      />
    </AppShell>
  );
}
