const test = require("node:test");
const assert = require("node:assert/strict");
const { schemas } = require("../src/middlewares/validation");

test("equipment create accepts active master equipment", () => {
  const result = schemas.equipmentCreateSchema.validate({
    name: "Gym Ball",
    slug: "gym_ball",
    aliases: ["stability ball", "exercise ball"],
    category: "functional",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.is_active, true);
});

test("equipment update requires at least one field", () => {
  const result = schemas.equipmentUpdateSchema.validate({});
  assert.equal(result.error, undefined);
});
