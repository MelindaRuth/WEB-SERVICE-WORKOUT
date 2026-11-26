const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");

const express = require("express");
const app = express();
app.use(express.json());
const paymentRouter = require("../src/routes/paymentRoutes");
app.use("/api/v1/payments", paymentRouter);

const request = supertest(app);

test("payment transaction requires authentication", async () => {
  const response = await request
    .post("/api/v1/payments/transaction")
    .send({ plan_id: 1 });
  assert.equal(response.status, 401);
  assert.equal(response.body.status, "fail");
});

test("payment notification stays public for Midtrans webhook", async () => {
  const response = await request
    .post("/api/v1/payments/notification")
    .send({ order_id: "invalid" });
  assert.equal(response.status, 403);
});
