import assert from "node:assert/strict";
import { marketingTiers } from "./plans";
import { PAID_PLANS } from "./pricing";

const tiers = marketingTiers();
assert.equal(tiers.length, 4, "Free + Builder + Pro + Max");

const free = tiers.find((t) => t.id === "free");
const builder = tiers.find((t) => t.id === "builder");
const pro = tiers.find((t) => t.id === "pro");
const max = tiers.find((t) => t.id === "max");

assert.equal(free?.priceCad, 0);
assert.equal(free?.checkout, false);
assert.equal(builder?.priceCad, 15);
assert.equal(pro?.priceCad, 25);
assert.equal(max?.priceCad, 45);
assert.equal(pro?.popular, true);
assert.equal(max?.checkout, true);

for (const paid of PAID_PLANS) {
  const card = tiers.find((t) => t.id === paid.id);
  assert.equal(card?.priceCad, paid.priceCad, `${paid.id} CAD must match Stripe`);
}

assert.ok(!tiers.some((t) => t.priceCad === 29), "legacy Pro $29 must not appear");

console.log("plans marketing tiers ok");
