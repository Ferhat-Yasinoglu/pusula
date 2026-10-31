import test from "node:test";
import assert from "node:assert/strict";
import { isPusulaServeCommand, requestSupervisedShutdown } from "@/lib/system/supervisedShutdown";

test("requestSupervisedShutdown signals the parent supervisor and does not kill the server", () => {
  const killed: number[] = [];
  const intents: number[] = [];
  const outcome = requestSupervisedShutdown({
    parentPid: 111,
    selfPid: 999,
    readPidFile: (service) => (service === "supervisor" ? 111 : 222),
    isPidRunning: (pid) => pid === 111,
    isSupervisorCommand: () => true,
    writeShutdownIntent: (pid) => intents.push(pid),
    killProcess: (pid) => killed.push(pid),
  });

  assert.equal(outcome, "supervisor");
  assert.deepEqual(killed, [111]);
  assert.deepEqual(intents, [999], "intent marker carries the child's own pid");
});

test("requestSupervisedShutdown ignores a supervisor pid that is not the parent", () => {
  const killed: number[] = [];
  const intents: number[] = [];
  const outcome = requestSupervisedShutdown({
    parentPid: 333,
    selfPid: 999,
    readPidFile: () => 111,
    isPidRunning: () => true,
    isSupervisorCommand: () => true,
    writeShutdownIntent: (pid) => intents.push(pid),
    killProcess: (pid) => killed.push(pid),
  });

  assert.equal(outcome, "none");
  assert.deepEqual(killed, []);
  // The intent marker is still written: the supervisor consumes it and exits
  // instead of restarting when the child then self-exits.
  assert.deepEqual(intents, [999]);
});

test("requestSupervisedShutdown ignores zero and negative pids", () => {
  for (const pid of [0, -5]) {
    const killed: number[] = [];
    const outcome = requestSupervisedShutdown({
      parentPid: pid,
      selfPid: 999,
      readPidFile: () => pid,
      isPidRunning: () => true,
      isSupervisorCommand: () => true,
      writeShutdownIntent: () => {},
      killProcess: (value) => killed.push(value),
    });
    assert.equal(outcome, "none");
    assert.deepEqual(killed, []);
  }
});

test("requestSupervisedShutdown ignores a parent whose command is not pusula serve", () => {
  const killed: number[] = [];
  const outcome = requestSupervisedShutdown({
    parentPid: 111,
    selfPid: 999,
    readPidFile: () => 111,
    isPidRunning: () => true,
    isSupervisorCommand: () => false,
    writeShutdownIntent: () => {},
    killProcess: (pid) => killed.push(pid),
  });

  assert.equal(outcome, "none");
  assert.deepEqual(killed, []);
});

test("isPusulaServeCommand accepts the default invocation without a subcommand", () => {
  // #16030 (P2): `serve` is the CLI default, so `pusula` alone is supervised.
  assert.equal(isPusulaServeCommand("node /usr/local/bin/pusula"), true);
  assert.equal(isPusulaServeCommand("node /usr/local/bin/pusula serve"), true);
  assert.equal(isPusulaServeCommand("node /usr/local/bin/pusula serve --port 20128"), true);
});

test("isPusulaServeCommand rejects other subcommands and non-pusula parents", () => {
  assert.equal(isPusulaServeCommand("node /usr/local/bin/pusula stop"), false);
  assert.equal(isPusulaServeCommand("node /usr/local/bin/pusula doctor"), false);
  assert.equal(isPusulaServeCommand("node /usr/local/bin/mypusula serve"), false);
  assert.equal(isPusulaServeCommand("node /app/server.js"), false);
  assert.equal(isPusulaServeCommand(""), false);
});
