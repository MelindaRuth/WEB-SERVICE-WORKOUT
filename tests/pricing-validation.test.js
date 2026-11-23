const test = require("node:test");
const assert = require("node:assert/strict");
const { schemas } = require("../src/middlewares/validation");

test("pricing plan cannot accept negative price", () => {
  const result = schemas.pricingPlanCreateSchema.validate({
    code: "premium_monthly",
    name: "Premium Bulanan",
    price: -1,
    duration_days: 30,
  });
  assert.ok(result.error);
});

test("pricing plan accepts dynamic active plan", () => {
  const result = schemas.pricingPlanCreateSchema.validate({
    code: "premium_yearly",
    name: "Premium Tahunan",
    price: 250000,
    duration_days: 365,
    currency: "idr",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.currency, "IDR");
});
