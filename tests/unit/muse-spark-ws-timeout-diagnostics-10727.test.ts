import test from "node:test";
import assert from "node:assert/strict";
import {
  MuseSparkWebExecutor,
  __resetMuseSparkConversationCacheForTesting,
  __setMuseSparkWebSocketForTesting,
} from "../../open-sse/executors/muse-spark-web.ts";
import { WebSocket } from "ws";

// #10727: Meta AI (muse-spark-web) times out on the WS send-message step at
// exactly the executor's hardcoded 30s timeout, with no onerror/onclose
// firing first. The reporter's log shows the flow reaching wsChat and
// hanging until the timeout fires, meaning Meta's gateway either never
// truly opens the socket or silently drops frames after opening — but the
// old flat "Meta AI WebSocket timed out" message could not distinguish
// those two failure modes for whoever debugs the next occurrence.
//
// Root-causing (and fixing) the reverse-engineered private WS protocol
// itself requires a live meta.ai session + a fresh DevTools capture (see
// the plan-file's `needs-vps` verdict) — not achievable in this sandbox.
// This regression test locks in the diagnosability improvement that *is*
// verifiable here: the timeout error now reports the socket's readyState
// at the moment it fires, so a future report can tell "never opened"
// (readyState 0) apart from "opened but Meta went silent" (readyState 1).

/**
 * Intercepts only the wsChat 30000ms timeout registration and lets every
 * other setTimeout (including the mock WebSocket's own onopen scheduling)
 * run for real. Firing the captured callback directly — instead of
 * advancing a fake clock — keeps the test fast and avoids interleaving
 * bugs between fake timers and the executor's real async/await chain.
 */
function interceptWsTimeout(): {
  fire: () => void;
  restore: () => void;
  registered: () => Promise<void>;
} {
  const original = globalThis.setTimeout;
  let captured: (() => void) | null = null;
  globalThis.setTimeout = ((cb: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    if (ms === 30000 && captured === null) {
      captured = cb as () => void;
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }
    return original(cb as () => void, ms, ...args);
  }) as typeof setTimeout;
  return {
    fire: () => {
      assert.ok(captured, "the 30000ms wsChat timeout was never registered");
      captured?.();
    },
    // Resolves once wsChat has registered its timeout — the executor reaches that point
    // only after the GraphQL awaits and the WS open, so waiting here (instead of a fixed
    // sleep) keeps the test deterministic on a loaded runner.
    registered: async () => {
      const deadline = Date.now() + 5000;
      while (captured === null && Date.now() < deadline) {
        await new Promise((r) => original(r, 5));
      }
      assert.ok(captured, "the 30000ms wsChat timeout was never registered within 5s");
    },
    restore: () => {
      globalThis.setTimeout = original;
    },
  };
}

class NeverOpensWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((evt: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((evt: Error) => void) | null = null;
  readyState = WebSocket.CONNECTING;
  url: string;
  constructor(url: string) {
    this.url = url;
    // Never calls onopen, onmessage, onerror, or onclose — mirrors the
    // reported symptom exactly: the socket just hangs until the timeout.
  }
  send(_data: Uint8Array | string) {}
  close() {}
}

let lastOpened: Promise<void> = Promise.resolve();

class OpensThenSilentWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((evt: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((evt: Error) => void) | null = null;
  readyState = WebSocket.CONNECTING;
  url: string;
  constructor(url: string) {
    this.url = url;
    lastOpened = new Promise((resolve) => {
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        this.onopen?.();
        resolve();
      }, 0);
    });
  }
  send(_data: Uint8Array | string) {}
  close() {}
}

function baseInput(connectionId: string): Parameters<MuseSparkWebExecutor["execute"]>[0] {
  return {
    model: "muse-spark",
    body: { messages: [{ role: "user", content: "ping" }] },
    stream: false,
    credentials: {
      apiKey: "ecto_1_sess=test123",
      connectionId,
      providerSpecificData: { authorization: "ecto1:test-auth-token" },
    },
    signal: null,
    log: null,
    upstreamExtraHeaders: undefined,
  } as Parameters<MuseSparkWebExecutor["execute"]>[0];
}

test("#10727: WS timeout while still CONNECTING reports readyState=0 (never opened)", async () => {
  __resetMuseSparkConversationCacheForTesting();
  const executor = new MuseSparkWebExecutor();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  const restore = __setMuseSparkWebSocketForTesting(
    NeverOpensWebSocket as unknown as typeof WebSocket
  );
  const timeoutHook = interceptWsTimeout();
  try {
    const resultPromise = executor.execute(baseInput("conn-10727-never-opens"));
    // Let the GraphQL warmup/mode-switch awaits and the WS constructor run
    // before the 30s timeout is registered.
    await new Promise((r) => setTimeout(r, 20));
    timeoutHook.fire();

    const result = await resultPromise;
    assert.equal(result.response.status, 502);
    const body = await result.response.json();
    assert.match(
      body.error.message,
      /readyState=0/,
      "timeout while the socket never left CONNECTING must report readyState=0"
    );
  } finally {
    globalThis.fetch = originalFetch;
    restore();
    timeoutHook.restore();
  }
});

test("#10727: WS timeout after a successful open reports readyState=1 (opened, then silent)", async () => {
  __resetMuseSparkConversationCacheForTesting();
  const executor = new MuseSparkWebExecutor();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  const restore = __setMuseSparkWebSocketForTesting(
    OpensThenSilentWebSocket as unknown as typeof WebSocket
  );
  const timeoutHook = interceptWsTimeout();
  try {
    const resultPromise = executor.execute(baseInput("conn-10727-opens-silent"));
    // Wait for the real sequence instead of sleeping a fixed 20ms: the GraphQL awaits,
    // the WS open (its own real setTimeout(...,0)) and the intro/prompt frames, up to the
    // point where wsChat registers its 30s timeout. A fixed sleep raced the open on a
    // loaded CI runner and reported readyState=0 for a socket that had not opened yet.
    await timeoutHook.registered();
    await lastOpened;
    timeoutHook.fire();

    const result = await resultPromise;
    assert.equal(result.response.status, 502);
    const body = await result.response.json();
    assert.match(
      body.error.message,
      /readyState=1/,
      "timeout after the socket reached OPEN must report readyState=1, not the never-opened case"
    );
  } finally {
    globalThis.fetch = originalFetch;
    restore();
    timeoutHook.restore();
  }
});
