const test = require("node:test");
const assert = require("node:assert/strict");
const { schemas } = require("../src/middlewares/validation");

test("payment transaction accepts account identity from JWT", () => {
  const result = schemas.paymentCreateSchema.validate({ plan_id: 1 });
  assert.equal(result.error, undefined);
  assert.equal(result.value.user_id, undefined);
});

test("payment transaction allows admin to select a target user", () => {
  const result = schemas.paymentCreateSchema.validate({ user_id: 7, plan_id: 1 });
  assert.equal(result.error, undefined);
  assert.equal(result.value.user_id, 7);
});

test("payment transaction rejects invalid target user", () => {
  const result = schemas.paymentCreateSchema.validate({ user_id: -1 });
  assert.ok(result.error);
});
