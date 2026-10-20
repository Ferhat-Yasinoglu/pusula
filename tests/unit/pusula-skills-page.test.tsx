/**
 * Unit tests for PusulaSkillsPageClient and its sub-components.
 * These are structural/file-system tests — they verify the correct component
 * split, file structure, source patterns, and exported symbols without DOM rendering.
 *
 * Run:
 *   vitest run tests/unit/pusula-skills-page.test.tsx
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const cwd = process.cwd();
const base = resolve(join(cwd, "src/app/(dashboard)/dashboard/pusula-skills"));

// ─── File structure ──────────────────────────────────────────────────────────

describe("File structure — pusula-skills directory", () => {
  it("old /dashboard/skills directory does not exist", () => {
    const oldPath = resolve(join(cwd, "src/app/(dashboard)/dashboard/skills"));
    expect(existsSync(oldPath), `Old skills/ directory must be absent (found at ${oldPath})`).toBe(
      false
    );
  });

  it("new /dashboard/pusula-skills directory exists", () => {
    expect(existsSync(base), `pusula-skills/ directory must exist at ${base}`).toBe(true);
  });

  const expectedFiles = [
    "page.tsx",
    "PusulaSkillsPageClient.tsx",
    "components/PusulaSkillCard.tsx",
    "components/SkillInspectorPane.tsx",
    "components/PusulaSkillsList.tsx",
    "components/PusulaExecutionsTab.tsx",
    "components/PusulaSandboxTab.tsx",
    "components/PusulaMarketplaceTab.tsx",
  ];

  for (const file of expectedFiles) {
    it(`file exists: pusula-skills/${file}`, () => {
      expect(existsSync(resolve(join(base, file))), `Expected pusula-skills/${file} to exist`).toBe(
        true
      );
    });
  }
});

// ─── page.tsx — server component ─────────────────────────────────────────────

describe("page.tsx — server component", () => {
  const src = readFileSync(resolve(join(base, "page.tsx")), "utf-8");

  it("is a server component (no 'use client' directive)", () => {
    expect(
      !src.includes('"use client"') && !src.includes("'use client'"),
      "page.tsx must not have 'use client'"
    ).toBe(true);
  });

  it("imports and renders PusulaSkillsPageClient", () => {
    expect(
      src.includes("PusulaSkillsPageClient"),
      "page.tsx must reference PusulaSkillsPageClient"
    ).toBe(true);
  });

  it("has a default export named Page", () => {
    expect(
      src.includes("export default function Page"),
      "page.tsx must have 'export default function Page'"
    ).toBe(true);
  });
});

// ─── PusulaSkillsPageClient.tsx ─────────────────────────────────────────────────

describe("PusulaSkillsPageClient.tsx", () => {
  const src = readFileSync(resolve(join(base, "PusulaSkillsPageClient.tsx")), "utf-8");

  it("starts with 'use client'", () => {
    expect(
      src.startsWith('"use client"'),
      "PusulaSkillsPageClient must start with 'use client'"
    ).toBe(true);
  });

  it("has all 4 tab IDs", () => {
    for (const tabId of ["skills", "executions", "sandbox", "marketplace"]) {
      expect(
        src.includes(`id: "${tabId}"`),
        `PusulaSkillsPageClient must have tab id="${tabId}"`
      ).toBe(true);
    }
  });

  it("renders SkillsConceptCard with variant='omni'", () => {
    expect(
      src.includes('variant="omni"'),
      'PusulaSkillsPageClient must render <SkillsConceptCard variant="omni" />'
    ).toBe(true);
  });

  it("imports SkillsConceptCard from shared components", () => {
    expect(
      src.includes("SkillsConceptCard"),
      "PusulaSkillsPageClient must import SkillsConceptCard"
    ).toBe(true);
  });

  it("has selectedSkillId state", () => {
    expect(
      src.includes("selectedSkillId"),
      "PusulaSkillsPageClient must maintain selectedSkillId state"
    ).toBe(true);
  });

  it("wires PusulaSkillsList with inspector props", () => {
    expect(
      src.includes("PusulaSkillsList"),
      "PusulaSkillsPageClient must render PusulaSkillsList"
    ).toBe(true);
    expect(
      src.includes("onSelectSkill"),
      "PusulaSkillsPageClient must pass onSelectSkill to PusulaSkillsList"
    ).toBe(true);
  });

  it("renders all 4 tab components", () => {
    for (const component of [
      "PusulaSkillsList",
      "PusulaExecutionsTab",
      "PusulaSandboxTab",
      "PusulaMarketplaceTab",
    ]) {
      expect(src.includes(component), `PusulaSkillsPageClient must render <${component}>`).toBe(
        true
      );
    }
  });

  it("has install modal with hardcoded 'X' close button (preserved behavior)", () => {
    expect(src.includes("showInstallModal"), "must preserve showInstallModal state").toBe(true);
  });
});

// ─── PusulaSkillCard.tsx ────────────────────────────────────────────────────────

describe("PusulaSkillCard.tsx", () => {
  const src = readFileSync(resolve(join(base, "components/PusulaSkillCard.tsx")), "utf-8");

  it("starts with 'use client'", () => {
    expect(src.startsWith('"use client"'), "must be a client component").toBe(true);
  });

  it("accepts skill, selected, onClick props", () => {
    expect(src.includes("PusulaSkillCardProps"), "must define PusulaSkillCardProps").toBe(true);
    expect(src.includes("selected:"), "must have selected prop").toBe(true);
    expect(src.includes("onClick:"), "must have onClick prop").toBe(true);
  });

  it("has role='button' for accessibility", () => {
    expect(src.includes('role="button"'), "must have role='button' for accessibility").toBe(true);
  });

  it("exports PusulaSkillCard", () => {
    expect(
      src.includes("export function PusulaSkillCard") || src.includes("export { PusulaSkillCard }"),
      "must export PusulaSkillCard"
    ).toBe(true);
  });

  it("exports PusulaSkill interface", () => {
    expect(
      src.includes("export interface PusulaSkill"),
      "must export PusulaSkill interface for other components"
    ).toBe(true);
  });
});

// ─── SkillInspectorPane.tsx ───────────────────────────────────────────────────

describe("SkillInspectorPane.tsx", () => {
  const src = readFileSync(resolve(join(base, "components/SkillInspectorPane.tsx")), "utf-8");

  it("starts with 'use client'", () => {
    expect(src.startsWith('"use client"'), "must be a client component").toBe(true);
  });

  it("has all 4 sub-tab IDs", () => {
    for (const tabId of ["schema", "handler", "executions", "sandbox"]) {
      expect(src.includes(`"${tabId}"`), `SkillInspectorPane must include sub-tab "${tabId}"`).toBe(
        true
      );
    }
  });

  it("has empty state text when no skill selected", () => {
    expect(
      src.includes("selectSkillToInspect"),
      "must have empty state message (i18n key selectSkillToInspect)"
    ).toBe(true);
  });

  it("fetches /api/skills/[id] for skill detail", () => {
    expect(
      src.includes("/api/skills/${selectedSkillId}") ||
        src.includes("`/api/skills/${selectedSkillId}`"),
      "must fetch /api/skills/${selectedSkillId} for detail"
    ).toBe(true);
  });

  it("fetches /api/skills/executions for the executions tab", () => {
    expect(
      src.includes("api/skills/executions?skillId=") || src.includes("api/skills/executions"),
      "must fetch executions for the selected skill"
    ).toBe(true);
  });

  it("has ON / AUTO / OFF / Uninstall buttons", () => {
    expect(src.includes("onSetMode"), "must call onSetMode for mode buttons").toBe(true);
    expect(src.includes("onUninstall"), "must call onUninstall").toBe(true);
  });
});

// ─── PusulaSkillsList.tsx ───────────────────────────────────────────────────────

describe("PusulaSkillsList.tsx", () => {
  const src = readFileSync(resolve(join(base, "components/PusulaSkillsList.tsx")), "utf-8");

  it("uses grid-cols-12 split layout", () => {
    expect(src.includes("grid-cols-12"), "must use 12-column grid for split layout").toBe(true);
  });

  it("renders PusulaSkillCard for each skill", () => {
    expect(src.includes("PusulaSkillCard"), "must render PusulaSkillCard per skill").toBe(true);
  });

  it("renders SkillInspectorPane on the right", () => {
    expect(src.includes("SkillInspectorPane"), "must include SkillInspectorPane in right col").toBe(
      true
    );
  });

  it("has onSelectSkill prop to control inspector state", () => {
    expect(src.includes("onSelectSkill"), "must accept onSelectSkill prop").toBe(true);
  });
});

// ─── PusulaExecutionsTab.tsx ────────────────────────────────────────────────────

describe("PusulaExecutionsTab.tsx", () => {
  const src = readFileSync(resolve(join(base, "components/PusulaExecutionsTab.tsx")), "utf-8");

  it("starts with 'use client'", () => {
    expect(src.startsWith('"use client"'), "must be a client component").toBe(true);
  });

  it("renders a table with skill/status/duration/time columns", () => {
    expect(src.includes('{t("skill")}'), "must have skill column").toBe(true);
    expect(src.includes('{t("status")}'), "must have status column").toBe(true);
    expect(src.includes('{t("duration")}'), "must have duration column").toBe(true);
  });

  it("has pagination buttons", () => {
    expect(src.includes("onPagePrev"), "must accept onPagePrev handler").toBe(true);
    expect(src.includes("onPageNext"), "must accept onPageNext handler").toBe(true);
  });
});

// ─── PusulaSandboxTab.tsx ───────────────────────────────────────────────────────

describe("PusulaSandboxTab.tsx", () => {
  const src = readFileSync(resolve(join(base, "components/PusulaSandboxTab.tsx")), "utf-8");

  it("starts with 'use client'", () => {
    expect(src.startsWith('"use client"'), "must be a client component").toBe(true);
  });

  it("shows sandbox config values", () => {
    expect(src.includes("100ms"), "must show 100ms CPU limit").toBe(true);
    expect(src.includes("256MB"), "must show 256MB memory limit").toBe(true);
    expect(src.includes("30s"), "must show 30s timeout").toBe(true);
  });
});

// ─── PusulaMarketplaceTab.tsx ───────────────────────────────────────────────────

describe("PusulaMarketplaceTab.tsx", () => {
  const src = readFileSync(resolve(join(base, "components/PusulaMarketplaceTab.tsx")), "utf-8");

  it("starts with 'use client'", () => {
    expect(src.startsWith('"use client"'), "must be a client component").toBe(true);
  });

  it("has marketplace search logic", () => {
    expect(
      src.includes("/api/skills/marketplace"),
      "must call /api/skills/marketplace endpoint"
    ).toBe(true);
  });

  it("has skills.sh search logic", () => {
    expect(src.includes("/api/skills/skillssh"), "must call /api/skills/skillssh endpoint").toBe(
      true
    );
  });

  it("accepts skillsProvider and onRefreshSkills props", () => {
    expect(src.includes("skillsProvider"), "must accept skillsProvider prop").toBe(true);
    expect(src.includes("onRefreshSkills"), "must accept onRefreshSkills prop").toBe(true);
  });
});

// ─── E2E test update ──────────────────────────────────────────────────────────

describe("E2E spec path", () => {
  const src = readFileSync(resolve(join(cwd, "tests/e2e/skills-marketplace.spec.ts")), "utf-8");

  it("uses /dashboard/pusula-skills (not /dashboard/skills)", () => {
    expect(
      src.includes("/dashboard/pusula-skills"),
      "E2E spec must navigate to /dashboard/pusula-skills"
    ).toBe(true);
    expect(
      !src.includes('"/dashboard/skills"') && !src.includes("'/dashboard/skills'"),
      "E2E spec must not have the old /dashboard/skills path in gotoDashboardRoute call"
    ).toBe(true);
  });
});
