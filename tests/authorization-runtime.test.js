const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");

const app = require("express")();
app.use(require("express").json());

const { requireAuth, requireAdmin } = require("../src/middlewares/auth");
app.get("/protected", requireAuth, (req, res) => res.json({ status: "success", data: req.auth }));
app.get("/admin", requireAuth, requireAdmin, (req, res) => res.json({ status: "success" }));

const request = supertest(app);

test("protected route rejects missing bearer token", async () => {
  const response = await request.get("/protected");
  assert.equal(response.status, 401);
  assert.equal(response.body.status, "fail");
});

test("admin route rejects missing bearer token", async () => {
  const response = await request.get("/admin");
  assert.equal(response.status, 401);
});

test("protected route rejects malformed bearer token", async () => {
  const response = await request.get("/protected").set("Authorization", "Bearer invalid-token");
  assert.equal(response.status, 401);
});
