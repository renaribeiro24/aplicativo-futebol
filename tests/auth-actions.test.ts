import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { login, signup } from "@/features/auth/actions";

describe("direct Server Action calls before configuration", () => {
  it.each([login, signup])(
    "rejects calls even if the disabled form is bypassed",
    async (action) => {
      const form = new FormData();
      form.set("email", "fixture@example.test");
      form.set("password", "fixture-password");
      expect(await action({}, form)).toEqual({
        error: "Autenticação ainda não configurada neste ambiente.",
      });
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );
});
