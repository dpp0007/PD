import test from "node:test";
import assert from "node:assert/strict";
import { applySync, normAttendance, normDate, type Stored } from "../lib/sync";

const row = (o: object) => normAttendance({ date: "02/11/2026", slot: " 08:30 to 09:20 ", status: "P", course: null, ...o });

test("dates and status normalize", () => {
  assert.equal(normDate("02/11/2026"), "2026-11-02");
  assert.equal(normDate("garbage"), null);
  assert.equal(row({ status: "Present" }).data.status, "P");
  assert.equal(row({}).key, "2026-11-02|08:30 to 09:20");
});

test("incremental sync: new -> unchanged -> updated, duplicates + incomplete kept and flagged", () => {
  const store: Stored = {};
  const a = applySync(store, [row({}), row({ slot: "09:20 to 10:10" }), row({})], "r1");
  assert.deepEqual(a, { new: 2, updated: 0, unchanged: 0, failed: 0, duplicates: 1 });
  const b = applySync(store, [row({}), row({ slot: "09:20 to 10:10" }), row({ date: "03/11/2026" })], "r2");
  assert.deepEqual(b, { new: 1, updated: 0, unchanged: 2, failed: 0, duplicates: 0 });
  const c = applySync(store, [row({ status: "A" })], "r3"); // status changed at source
  assert.equal(c.updated, 1);
  const d = applySync(store, [normAttendance({ date: "nope", slot: "x", status: "P" }), normAttendance({ date: "nope2", slot: "y" })], "r4");
  assert.equal(d.failed, 2); // two bad rows are two records, not merged
  assert.equal(Object.values(store).filter((x) => x.status === "incomplete").length, 2);
});

test("change log records new and updated with before/after", () => {
  const store: Stored = {};
  const log: import("../lib/sync").Change[] = [];
  applySync(store, [row({})], "r1", log);
  applySync(store, [row({ status: "A" })], "r2", log);
  assert.deepEqual(log.map((c) => c.kind), ["new", "updated"]);
  assert.equal(log[1].before?.status, "P");
  assert.equal(log[1].after.status, "A");
});
