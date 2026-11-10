import { describe, it, expect } from "vitest";
import {
  cents,
  moneyInput,
  parseSchedule,
  parsePricing,
  parseBilling,
  parseEnd,
  todayInTimezone,
  periodState,
  pageNumber,
  errorMessage,
} from "@/features/groups/operations/validation";
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
const schedule = {
  weekday: "1",
  starts_at_local: "19:30",
  duration_minutes: "90",
  recurrence_type: "weekly",
  starts_on: "2026-11-16",
  ends_on: "",
  is_active: "on",
};
describe("operational configuration validation", () => {
  it.each([
    ["80,25", 8025],
    ["25.5", 2550],
    ["0", 0],
    ["21474836,47", 2147483647],
  ])("stores %s as exact integer cents", (input, expected) =>
    expect(cents(String(input))).toBe(expected),
  );
  it.each(["-1", "1.234,56", "1e3", "80,123", "", "00", "21474836,48", "NaN"])(
    "rejects malformed or out-of-range money %s",
    (value) => expect(() => cents(value)).toThrow(),
  );
  it("formats cents without inventing a value", () => {
    expect(moneyInput(null)).toBe("");
    expect(moneyInput(8025)).toBe("80,25");
    expect(moneyInput(0)).toBe("0,00");
  });
  it.each(["weekly", "biweekly"])(
    "derives the reference interval for %s",
    (type) => {
      const result = parseSchedule(
        form({
          ...schedule,
          recurrence_type: type,
          interval_weeks: "999",
          group_id: "forged",
        }),
      );
      expect(result.interval_weeks).toBe(type === "weekly" ? 1 : 2);
      expect(result).not.toHaveProperty("group_id");
      expect(result.starts_on).toBe("2026-11-16");
    },
  );
  it.each([
    { weekday: "2" },
    { weekday: "7" },
    { starts_at_local: "24:00" },
    { duration_minutes: "0" },
    { duration_minutes: "1.5" },
    { ends_on: "2026-11-15" },
    { starts_on: "2026-02-30" },
    { recurrence_type: "monthly" },
    { venue_id: "invalid" },
  ])("rejects invalid schedule fields", (values) =>
    expect(() =>
      parseSchedule(form({ ...schedule, ...values } as Record<string, string>)),
    ).toThrow(),
  );
  it("treats an unchecked agenda as inactive", () => {
    const f = form(schedule);
    f.delete("is_active");
    expect(parseSchedule(f).is_active).toBe(false);
  });
  it("nulls disabled prices and never applies defaults", () => {
    const r = parsePricing(
      form({
        effective_from: "2026-11-16",
        monthly_amount: "80",
        casual_amount: "25",
        due_day: "10",
      }),
      "2026-11-10",
    );
    expect(r.monthly_amount_cents).toBeNull();
    expect(r.casual_amount_cents).toBeNull();
    expect(r.due_day).toBeNull();
  });
  it("requires explicit amounts and due day for enabled monthly mode", () => {
    const base = {
      monthly_enabled: "on",
      monthly_amount: "80,01",
      due_day: "31",
      effective_from: "2026-11-16",
    };
    expect(parsePricing(form(base), "2026-11-10").monthly_amount_cents).toBe(
      8001,
    );
    for (const changed of [
      { monthly_amount: "" },
      { due_day: "32" },
      { due_day: "0" },
      { monthly_amount: "-1" },
      { effective_from: "2026-11-09" },
      { effective_until: "2026-11-16" },
    ])
      expect(() =>
        parsePricing(
          form({ ...base, ...changed } as Record<string, string>),
          "2026-11-10",
        ),
      ).toThrow();
  });
  it.each(["monthly", "casual"])(
    "accepts only existing billing type %s",
    (type) =>
      expect(
        parseBilling(
          form({ billing_type: type, effective_from: "2026-11-16" }),
          "2026-11-10",
        ).billing_type,
      ).toBe(type),
  );
  it("rejects new roles/categories masquerading as billing types", () =>
    expect(() =>
      parseBilling(
        form({ billing_type: "treasurer", effective_from: "2026-11-16" }),
        "2026-11-10",
      ),
    ).toThrow());
  it("uses the group timezone and exclusive period end", () => {
    const now = new Date("2026-11-11T01:00:00Z");
    expect(todayInTimezone("America/Sao_Paulo", now)).toBe("2026-11-10");
    expect(todayInTimezone("UTC", now)).toBe("2026-11-11");
    expect(
      periodState(
        { effective_from: "2026-11-01", effective_until: "2026-11-10" },
        "2026-11-10",
      ),
    ).toBe("ended");
    expect(
      periodState(
        { effective_from: "2026-11-10", effective_until: null },
        "2026-11-10",
      ),
    ).toBe("current");
  });
  it("allows only a strictly future end after the version start", () => {
    expect(
      parseEnd(
        form({ effective_until: "2026-11-12" }),
        "2026-11-10",
        "2026-11-01",
      ),
    ).toBe("2026-11-12");
    expect(() =>
      parseEnd(
        form({ effective_until: "2026-11-10" }),
        "2026-11-10",
        "2026-11-01",
      ),
    ).toThrow();
  });
  it("bounds pagination and sanitizes database errors", () => {
    expect(pageNumber("999999999")).toBe(100000);
    expect(pageNumber(["2"])).toBe(1);
    expect(errorMessage({ code: "23P01" })).toContain("vigência");
    expect(errorMessage(Error("secret upstream value"))).not.toContain(
      "secret upstream",
    );
  });
});
