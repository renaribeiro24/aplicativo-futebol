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
import { emptyLocation } from "@/features/groups/location/model";
describe("location form rendering — synthetic only", () => {
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
