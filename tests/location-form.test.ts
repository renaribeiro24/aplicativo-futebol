import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
vi.mock("@/features/groups/location/actions", () => ({
  savePrimaryLocation: vi.fn(),
}));
vi.mock("@/components/forms/action-form", () => ({
  ActionForm: ({
    children,
    disabled,
  }: {
    children: ReactNode;
    disabled?: boolean;
  }) =>
    createElement(
      "form",
      null,
      createElement(
        "fieldset",
        { disabled },
        children,
        createElement("button", { type: "submit" }, "Salvar local principal"),
      ),
    ),
}));
import {
  PrimaryLocationForm,
  LocationPreview,
} from "@/features/groups/location/form";
import { emptyLocation, parseLocation } from "@/features/groups/location/model";
describe("location form rendering — synthetic only", () => {
  it("retains coordinates internally without editable coordinate fields", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const html = renderToStaticMarkup(
      createElement(PrimaryLocationForm, {
        slug: "alpha",
        state: {
          ready: true,
          primaryId: id,
          venues: [
            {
              ...emptyLocation,
              id,
              name: "Campo sintético",
              latitude: "0",
              longitude: "0",
              updated_at: "2026-11-23T12:00:00Z",
              superseded_at: null,
            },
          ],
        },
        searchEnabled: false,
      }),
    );
    for (const key of ["latitude", "longitude"]) {
      const input = html.match(
        new RegExp(`<input[^>]*name="${key}"[^>]*>`),
      )?.[0];
      expect(input).toContain('type="hidden"');
      expect(input).toContain('value="0"');
      expect(input).not.toContain("inputMode");
    }
    expect(html).not.toContain("Latitude (opcional)");
    expect(html).not.toContain("Longitude (opcional)");
    expect(html).toContain("Visualizar mapa");
    expect(html).toContain("destination=0%2C0");
  });
  it("accepts a manual address without coordinates", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      name: "Campo sintético",
      street: "Rua sintética",
      city: "Cidade sintética",
      state: "SP",
      latitude: "",
      longitude: "",
    }))
      form.set(key, value);
    const parsed = parseLocation(form);
    expect(parsed.p_street).toBe("Rua sintética");
    expect(parsed).not.toHaveProperty("p_latitude");
    expect(parsed).not.toHaveProperty("p_longitude");
  });

  it("offers manual input while provider is off without a fake success", () => {
    const html = renderToStaticMarkup(
      createElement(PrimaryLocationForm, {
        slug: "alpha",
        state: { ready: true, primaryId: null, venues: [] },
        searchEnabled: false,
      }),
    );
    expect(html).toContain("manualmente");
    for (const name of [
      "name",
      "postal_code",
      "street",
      "city",
      "state",
      "latitude",
      "longitude",
    ])
      expect(html).toContain(`name="${name}"`);
    expect(html).not.toContain('name="timezone"');
    expect(html).not.toContain("feedback-success");
  });
  it("disables persistence and explains pending schema honestly", () => {
    const html = renderToStaticMarkup(
      createElement(PrimaryLocationForm, {
        slug: "alpha",
        state: { ready: false, primaryId: null, venues: [] },
        searchEnabled: false,
      }),
    );
    expect(html).toContain("fieldset disabled");
    expect(html).toContain("atualização autorizada do banco");
  });
  it("does not load an external iframe until the user requests it", () => {
    const html = renderToStaticMarkup(
      createElement(LocationPreview, {
        value: {
          ...emptyLocation,
          name: "Campo sintético",
          latitude: "0",
          longitude: "0",
        },
      }),
    );
    expect(html).toContain("Visualizar mapa");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("https://www.google.com/maps/dir/");
  });
});
