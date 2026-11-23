const test = require("node:test");
const assert = require("node:assert/strict");
const { schemas } = require("../src/middlewares/validation");

test("login refresh token schema requires refresh_token", () => {
  const missing = schemas.authRefreshSchema.validate({});
  assert.ok(missing.error);

  const valid = schemas.authRefreshSchema.validate({ refresh_token: "header.payload.signature" });
  assert.equal(valid.error, undefined);
});

test("role only accepts user or admin", () => {
  const invalid = schemas.adminUserUpdateSchema.validate({ role: "premium" });
  assert.ok(invalid.error);

  const valid = schemas.adminUserUpdateSchema.validate({ role: "admin", is_premium: true });
  assert.equal(valid.error, undefined);
});
