import test from "node:test";
import assert from "node:assert/strict";
import { normAirtel, normMoney } from "../lib/airtel";
import { applySync, type Stored } from "../lib/sync";

test("money parses", () => {
  assert.deepEqual(normMoney("₹1,299.00"), { amount: 1299, currency: "INR" });
  assert.deepEqual(normMoney("Rs. 499"), { amount: 499, currency: "INR" });
  assert.deepEqual(normMoney("free"), { amount: null, currency: null });
});

test("airtel keys: id first, composite fallback, bad rows kept and flagged", () => {
  const a = normAirtel({ id: " TX1 ", date: "05/11/2026", type: "Recharge", amount: "₹299" });
  assert.equal(a.key, "id:TX1");
  assert.equal(a.data.date, "2026-11-05");
  const b = normAirtel({ date: "05/11/2026", type: "bill", amount: "₹999", account: "x" });
  assert.equal(b.key, "2026-11-05|bill|999|x");
  const store: Stored = {};
  const d = applySync(store, [a, b, normAirtel({ date: "??", amount: "?" })], "r1");
  assert.deepEqual([d.new, d.failed], [2, 1]);
  assert.equal(applySync(store, [a, b], "r2").unchanged, 2);
});
