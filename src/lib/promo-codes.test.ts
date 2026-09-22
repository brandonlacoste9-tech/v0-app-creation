/**
 * Run: npx tsx src/lib/promo-codes.test.ts
 */
import assert from "node:assert/strict";
import {
  isQaUnlockCode,
  isQaUnlockEnabled,
  isValidProCode,
  resolvePromoGrant,
} from "./promo-codes";

const prevQa = process.env.QA_UNLOCK_CODE;
const prevPromo = process.env.PROMO_CODES;
const prevBuiltin = process.env.ALLOW_BUILTIN_PROMO_CODES;
const prevNode = process.env.NODE_ENV;

try {
  process.env.NODE_ENV = "production";
  process.env.ALLOW_BUILTIN_PROMO_CODES = "0";
  delete process.env.PROMO_CODES;
  delete process.env.QA_UNLOCK_CODE;

  assert.equal(isQaUnlockEnabled(), false, "disabled when unset");
  assert.equal(isQaUnlockCode("anything-long-enough"), false, "no secret → reject");
  assert.equal(resolvePromoGrant("NORTH-PRO"), null, "builtins off in production");

  process.env.QA_UNLOCK_CODE = "short";
  assert.equal(isQaUnlockEnabled(), false, "refuse short secret");
  assert.equal(isQaUnlockCode("short"), false, "short secret never matches");

  const secret = "SBQA-unit-test-secret";
  process.env.QA_UNLOCK_CODE = secret;
  assert.equal(isQaUnlockEnabled(), true);
  assert.equal(isQaUnlockCode(secret), true, "exact match");
  assert.equal(isQaUnlockCode(" " + secret + " "), true, "trim");
  assert.equal(isQaUnlockCode(secret.toLowerCase()), false, "case-sensitive");
  assert.equal(isQaUnlockCode("SBQA-unit-test-secreX"), false, "wrong char");
  assert.equal(resolvePromoGrant(secret)?.plan, "max");
  assert.equal(resolvePromoGrant(secret)?.kind, "qa");

  process.env.PROMO_CODES = "KEEP-BUILDING";
  assert.equal(resolvePromoGrant("keep-building")?.plan, "pro");
  assert.equal(resolvePromoGrant(secret)?.plan, "max", "QA wins over Pro list");
  assert.equal(isValidProCode("KEEP-BUILDING"), true);

  console.log("promo-codes tests: all passed");
} finally {
  if (prevQa === undefined) delete process.env.QA_UNLOCK_CODE;
  else process.env.QA_UNLOCK_CODE = prevQa;
  if (prevPromo === undefined) delete process.env.PROMO_CODES;
  else process.env.PROMO_CODES = prevPromo;
  if (prevBuiltin === undefined) delete process.env.ALLOW_BUILTIN_PROMO_CODES;
  else process.env.ALLOW_BUILTIN_PROMO_CODES = prevBuiltin;
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
}
