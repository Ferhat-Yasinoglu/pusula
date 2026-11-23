// @vitest-environment jsdom
// The landing page's "Ask for access" form: what it posts and what it shows for each answer.
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../../src/app/landing/components/primitives/MagneticButton", () => ({
  default: ({
    children,
    type,
    disabled,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit";
    disabled?: boolean;
  }) => (
    <button type={type} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("../../src/app/landing/components/access/access.css", () => ({}));

import AccessRequest from "../../src/app/landing/components/access/AccessRequest";

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

function fill(name: string, value: string) {
  const el = container.querySelector(`[name="${name}"]`) as HTMLInputElement;
  el.value = value;
}

async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("AccessRequest (landing form)", () => {
  beforeEach(async () => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<AccessRequest />));
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("posts the trimmed fields and thanks the visitor", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    fill("name", "  Ada ");
    fill("email", "ada@example.com");
    fill("reason", "");
    await submit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/access-request");
    expect(JSON.parse(init.body)).toEqual({ name: "Ada", email: "ada@example.com" });
    expect(container.querySelector('[role="status"]')?.textContent).toBe("accessSent");
    expect(container.querySelector("form")).toBeNull();
  });

  it.each([
    [400, "accessErrorInvalid"],
    [429, "accessErrorRate"],
    [503, "accessErrorClosed"],
    [500, "accessErrorGeneric"],
  ])("shows the right message for a %i answer and keeps the form", async (status, key) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }));
    fill("name", "Ada");
    fill("email", "ada@example.com");
    await submit();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(key);
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("sends the honeypot when something filled it", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    fill("name", "Bot");
    fill("email", "bot@example.com");
    fill("website", "http://spam.example");
    await submit();

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).website).toBe("http://spam.example");
  });
});
