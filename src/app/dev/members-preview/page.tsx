import { notFound } from "next/navigation";
import { MembersPanel } from "@/features/members/panel";
import type { MemberData } from "@/features/members/model";
export default function MembersDemo() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.MEMBERS_UI_DEMO !== "1"
  )
    notFound();
  const data: MemberData = {
    role: "owner",
    members: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Pessoa sintética — Proprietária",
        nickname: null,
        avatar: null,
        role: "owner",
        status: "active",
        email: "owner@example.invalid",
        billing: "casual",
        periods: [{ start: "2026-11-23T12:00:00Z", end: null }],
        terms: [
          {
            id: "term1",
            type: "casual",
            from: "2026-11-23",
            until: null,
            period: "scope",
          },
        ],
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Pessoa sintética — Jogadora",
        nickname: "Bora pro jogo!",
        avatar: null,
        role: "player",
        status: "active",
        email: "player@example.invalid",
        billing: "monthly",
        periods: [{ start: "2026-11-23T12:00:00Z", end: null }],
        terms: [],
      },
    ],
    invitations: [],
    links: [],
    requests: [],
  };
  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-6 text-3xl font-semibold">
        Integrantes · demonstração sintética
      </h1>
      <MembersPanel
        data={data}
        slug="synthetic-only"
        demo
        individual={{
          requestId: "11111111-1111-4111-8111-111111111111",
          token: "a".repeat(64),
        }}
        shared={{
          requestId: "22222222-2222-4222-8222-222222222222",
          token: "b".repeat(64),
        }}
      />
    </main>
  );
}
