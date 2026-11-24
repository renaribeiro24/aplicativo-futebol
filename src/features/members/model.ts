import type { MemberRole } from "./validation";
export type Period = { start: string; end: string | null };
export type Term = {
  id: string;
  type: "monthly" | "casual";
  from: string;
  until: string | null;
  period: string | null;
};
export type Member = {
  id: string;
  name: string;
  nickname: string | null;
  avatar: string | null;
  role: MemberRole;
  status: string;
  email: string | null;
  billing: string | null;
  periods: Period[];
  terms: Term[];
};
export type Invitation = {
  id: string;
  email: string;
  expires: string;
  accepted: string | null;
  revoked: string | null;
  delivery: string | null;
};
export type JoinLink = {
  id: string;
  label: string;
  max: number | null;
  used: number;
  revoked: string | null;
};
export type JoinRequest = {
  id: string;
  name: string;
  email: string;
  state: string;
  created: string;
};
export type MemberData = {
  role: MemberRole;
  members: Member[];
  invitations: Invitation[];
  links: JoinLink[];
  requests: JoinRequest[];
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Invalid member response");
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  if (typeof v !== "string") throw Error("Invalid member response");
  return v;
}
function nullable(v: unknown) {
  return v === null || v === undefined ? null : str(v);
}
function arr(v: unknown): unknown[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw Error("Invalid member response");
  return v;
}
function role(v: unknown): MemberRole {
  if (v !== "owner" && v !== "admin" && v !== "player" && v !== "guest")
    throw Error("Invalid role");
  return v;
}
function num(v: unknown) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0)
    throw Error("Invalid count");
  return v;
}
export function parseMemberData(value: unknown): MemberData {
  const d = object(value);
  return {
    role: role(d.role),
    members: arr(d.members).map((x) => {
      const m = object(x);
      return {
        id: str(m.id),
        name: str(m.name),
        nickname: nullable(m.nickname),
        avatar: nullable(m.avatar),
        role: role(m.role),
        status: str(m.status),
        email: nullable(m.email),
        billing: nullable(m.billing),
        periods: arr(m.periods).map((p) => {
          const z = object(p);
          return { start: str(z.start), end: nullable(z.end) };
        }),
        terms: arr(m.terms).map((t) => {
          const z = object(t);
          if (z.type !== "monthly" && z.type !== "casual")
            throw Error("Invalid billing");
          return {
            id: str(z.id),
            type: z.type,
            from: str(z.from),
            until: nullable(z.until),
            period: nullable(z.period),
          };
        }),
      };
    }),
    invitations: arr(d.invitations).map((x) => {
      const i = object(x);
      return {
        id: str(i.id),
        email: str(i.email),
        expires: str(i.expires),
        accepted: nullable(i.accepted),
        revoked: nullable(i.revoked),
        delivery: nullable(i.delivery),
      };
    }),
    links: arr(d.links).map((x) => {
      const l = object(x);
      return {
        id: str(l.id),
        label: str(l.label),
        max: l.max === null ? null : num(l.max),
        used: num(l.used),
        revoked: nullable(l.revoked),
      };
    }),
    requests: arr(d.requests).map((x) => {
      const r = object(x);
      return {
        id: str(r.id),
        name: str(r.name),
        email: str(r.email),
        state: str(r.state),
        created: str(r.created),
      };
    }),
  };
}
