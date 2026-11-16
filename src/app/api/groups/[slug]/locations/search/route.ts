import { getCurrentUser } from "@/features/auth/session";
import { canManage } from "@/features/groups/validation";
import { unstable_rethrow } from "next/navigation";
import { loadGroup } from "@/features/groups/server";
import {
  searchConfigured,
  searchLocations,
  boundedText,
} from "@/features/groups/location/provider";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
// Best-effort per-instance budget; provider account quotas are also required.
const budget = new Map<string, { until: number; count: number }>();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      return Response.json(
        { error: "Envie uma pesquisa JSON." },
        { status: 415, headers },
      );
    if (!(await getCurrentUser()))
      return Response.json(
        { error: "Não autenticado." },
        { status: 401, headers },
      );
    const { slug } = await params;
    const context = await loadGroup(slug);
    if (!canManage(context.role))
      return Response.json(
        { error: "Sem permissão para pesquisar locais deste grupo." },
        { status: 403, headers },
      );
    if (!searchConfigured())
      return Response.json(
        {
          error: "Busca externa não ativada. Preencha o endereço manualmente.",
        },
        { status: 503, headers },
      );
    let body: unknown;
    try {
      body = JSON.parse(await boundedText(new Response(request.body), 1024));
    } catch {
      return Response.json(
        { error: "Pesquisa inválida ou muito longa." },
        { status: 400, headers },
      );
    }
    const query =
      typeof body === "object" &&
      body !== null &&
      "query" in body &&
      typeof body.query === "string"
        ? body.query.trim()
        : "";
    if (
      query.length < 3 ||
      query.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(query)
    )
      return Response.json(
        { error: "Digite entre 3 e 200 caracteres." },
        { status: 400, headers },
      );
    const now = Date.now();
    for (const [key, v] of budget) if (v.until <= now) budget.delete(key);
    const key = context.user.id;
    const value = budget.get(key) ?? { count: 0, until: now + 60000 };
    if (value.count >= 12 || (!budget.has(key) && budget.size >= 5000))
      return Response.json(
        { error: "Aguarde um minuto ou preencha manualmente." },
        { status: 429, headers },
      );
    value.count++;
    budget.set(key, value);
    const results = await searchLocations(query);
    return Response.json({ results }, { headers });
  } catch (error) {
    unstable_rethrow(error);
    return Response.json(
      {
        error:
          "Não foi possível pesquisar. Confira seu acesso ou preencha manualmente.",
      },
      { status: 503, headers },
    );
  }
}
