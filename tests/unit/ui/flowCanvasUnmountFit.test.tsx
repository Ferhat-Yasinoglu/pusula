// @vitest-environment jsdom
/**
 * FlowCanvas defers its initial `fitView` with a timer (React Flow has to measure the
 * viewport first). That timer must die with the component: a `fitView` that fires after
 * unmount dispatches store updates on a torn-down React Flow instance, which surfaces in
 * jsdom suites as an unhandled "window is not defined" once the environment is gone.
 *
 * React Flow is stubbed so the test owns the instance handed to `onInit`.
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fitView = vi.fn();

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  function ReactFlowStub(props: {
    onInit?: (instance: { fitView: typeof fitView }) => void;
    children?: React.ReactNode;
  }) {
    const { onInit } = props;
    React.useEffect(() => {
      // Mirrors @xyflow/react's useOnInitHandler: onInit is delivered on a 1ms timer that
      // the library does not cancel on unmount, so it can land after the consumer is gone.
      setTimeout(() => onInit?.({ fitView }), 1);
    }, [onInit]);
    return <div className="react-flow-stub">{props.children}</div>;
  }
  return {
    ...actual,
    ReactFlow: ReactFlowStub,
    Controls: () => null,
  };
});

import { FlowCanvas } from "@/shared/components/flow/FlowCanvas";

const nodes = [
  { id: "a", position: { x: 0, y: 0 }, data: { label: "A" } },
  { id: "b", position: { x: 120, y: 0 }, data: { label: "B" } },
];
const edges = [{ id: "a-b", source: "a", target: "b" }];

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;

beforeAll(() => {
  // FlowCanvas observes its container; jsdom ships no ResizeObserver.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  fitView.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

describe("FlowCanvas deferred fitView lifecycle", () => {
  it("fits the view once React Flow has initialised and the deferral elapsed", () => {
    act(() => {
      root.render(<FlowCanvas nodes={nodes} edges={edges} fitKey="x" />);
    });
    expect(fitView).not.toHaveBeenCalled();

    act(() => {
      vi.runAllTimers();
    });
    expect(fitView).toHaveBeenCalled();
  });

  it("drops the deferred fitView when the canvas unmounts before the timer fires", () => {
    act(() => {
      root.render(<FlowCanvas nodes={nodes} edges={edges} fitKey="x" />);
    });
    // Let React Flow's deferred onInit land (1ms) so the fitView timer is armed, then unmount
    // before that timer fires.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {
      root.unmount();
    });
    // Re-create a root for afterEach to tear down (the one above is gone).
    root = createRoot(container);

    act(() => {
      vi.runAllTimers();
    });
    expect(fitView).not.toHaveBeenCalled();
  });

  it("ignores an onInit that React Flow delivers after the canvas already unmounted", () => {
    act(() => {
      root.render(<FlowCanvas nodes={nodes} edges={edges} fitKey="x" />);
    });
    // Unmount while the library's 1ms onInit timer is still pending: the late onInit must not
    // re-arm the fitView the unmount just cleared (the jsdom "window is not defined" leak).
    act(() => {
      root.unmount();
    });
    root = createRoot(container);

    act(() => {
      vi.runAllTimers();
    });
    expect(fitView).not.toHaveBeenCalled();
  });
});
