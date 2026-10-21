// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { FlowCanvas } from "@/shared/components/flow/FlowCanvas";

beforeAll(() => {
  // ReactFlow relies on ResizeObserver, which jsdom does not implement.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const containers: HTMLElement[] = [];
const roots: Array<ReturnType<typeof createRoot>> = [];

function mount(ui: React.ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(ui);
  });
  return container;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  // Unmount before the jsdom environment is torn down: a root left mounted keeps React
  // scheduler work queued and it fires after teardown as "window is not defined".
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => {
      root?.unmount();
    });
  }
  while (containers.length > 0) {
    containers.pop()?.remove();
  }
  document.body.innerHTML = "";
});

const nodes = [
  { id: "a", position: { x: 0, y: 0 }, data: { label: "A" } },
  { id: "b", position: { x: 120, y: 0 }, data: { label: "B" } },
];
const edges = [{ id: "a-b", source: "a", target: "b" }];

describe("FlowCanvas (U0 — shared ReactFlow wrapper)", () => {
  it("renders the canvas with Controls and hides the attribution", () => {
    const container = mount(<FlowCanvas nodes={nodes} edges={edges} fitKey="x" />);
    expect(container.querySelector(".react-flow.pusula-flow")).toBeTruthy();
    expect(container.querySelector(".react-flow__controls")).toBeTruthy();
    // proOptions.hideAttribution => the attribution element must not render.
    expect(container.querySelector(".react-flow__attribution")).toBeNull();
  });

  it("applies the provided container className for sizing/theming", () => {
    const container = mount(
      <FlowCanvas nodes={nodes} edges={edges} className="pusula-test-canvas h-[300px]" />
    );
    expect(container.querySelector(".pusula-test-canvas")).toBeTruthy();
  });

  it("themes controls through React Flow variables so library shorthands cannot override them", () => {
    const css = readFileSync(resolve("src/app/globals.css"), "utf8");

    expect(css).toContain(".react-flow.pusula-flow");
    expect(css).toContain("--xy-controls-button-background-color: var(--color-surface)");
    expect(css).toContain("--xy-controls-button-color: var(--color-text-main)");
    expect(css).toContain("--xy-controls-button-border-color: var(--color-border)");
  });
});
