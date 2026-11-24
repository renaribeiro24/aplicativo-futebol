import { notFound } from "next/navigation";
import { MembersPanel } from "@/features/members/panel";
import type { MemberData } from "@/features/members/model";
export default async function MembersDemo({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const query = await searchParams;
  const viewer =
    query.role === "admin"
      ? "admin"
      : query.role === "player"
        ? "player"
        : "owner";
  if (
    process.env.NODE_ENV === "production" ||
    process.env.MEMBERS_UI_DEMO !== "1"
  )
    notFound();
  const data: MemberData = {
    role: viewer,
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
    invitations: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        email: "invite@example.invalid",
        expires: "2030-12-31T12:00:00Z",
        accepted: null,
        revoked: null,
        delivery: "blocked",
      },
    ],
    links: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        label: "Link sintético de ingresso",
        max: 2,
        used: 1,
        revoked: null,
      },
    ],
    requests: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        name: "Pessoa solicitante sintética",
        email: "request@example.invalid",
        state: "pending",
        created: "2026-11-24T12:00:00Z",
      },
    ],
  };
  data.members.push({
    id: "33333333-3333-4333-8333-333333333333",
    name: "Pessoa sintética — Inativa",
    nickname: null,
    avatar: null,
    role: "player",
    status: "suspended",
    email: "inactive@example.invalid",
    billing: null,
    periods: [{ start: "2026-10-01T12:00:00Z", end: "2026-11-01T12:00:00Z" }],
    terms: [],
  });
  if (viewer === "player") {
    data.members = data.members
      .filter((m) => m.status === "active")
      .map((m) => ({
        ...m,
        email: null,
        billing: m.role === "player" ? m.billing : null,
        terms: m.role === "player" ? m.terms : [],
      }));
    data.invitations = [];
    data.links = [];
    data.requests = [];
  }
  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-6 text-3xl font-semibold">
        Integrantes · demonstração sintética
      </h1>
      <MembersPanel
        data={data}
        slug="synthetic-only"
        demo
        observedAt="2026-11-24T12:00:00Z"
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
