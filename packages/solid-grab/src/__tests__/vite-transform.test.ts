import { describe, expect, test } from "bun:test";

import { transformSolidGrabSource } from "../vite";

describe("solidGrab Vite transform", () => {
  test("annotates intrinsic JSX elements with component and source metadata", () => {
    const code = `
      export function NestedCard() {
        return <section><button data-testid="target"><span>Copy me</span></button></section>;
      }
    `;

    const transformed = transformSolidGrabSource(
      code,
      "/repo/apps/web/src/fixtures/basic.tsx",
      "/repo",
    );

    expect(transformed).toContain('data-solid-grab-component="NestedCard"');
    expect(transformed).toContain('data-solid-grab-source="apps/web/src/fixtures/basic.tsx"');
    expect(transformed).toContain("data-solid-grab-line=");
  });

  test("does not annotate custom component tags", () => {
    const code = `
      const NestedCard = () => <Wrapper><span>Copy me</span></Wrapper>;
    `;

    const transformed = transformSolidGrabSource(
      code,
      "/repo/apps/web/src/fixtures/basic.tsx",
      "/repo",
    );

    expect(transformed).not.toContain("<Wrapper data-solid-grab");
    expect(transformed).toContain("<span data-solid-grab");
  });
});
