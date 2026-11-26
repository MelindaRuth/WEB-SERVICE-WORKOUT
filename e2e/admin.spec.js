const { test, expect } = require("@playwright/test");

test("admin can login and open management panels", async ({ page }) => {
  await page.route("**/api/v1/users/login", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: {
          id: 4,
          nama: "Administrator",
          username: "admin",
          email: "admin@fitai.local",
          role: "admin",
          is_premium: false,
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
        },
      }),
    });
  });

  await page.route("**/api/v1/users/4", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: { id: 4, nama: "Administrator", username: "admin", email: "admin@fitai.local", role: "admin", is_premium: false, workout_logs: [] },
      }),
    });
  });

  await page.route("**/api/v1/admin/dashboard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "success", data: { total_users: 4, free_users: 2, premium_users: 1, admin_users: 1, total_exercises: 10, total_equipments: 5, total_workout_logs: 3, paid_transactions: 1 } }),
    });
  });

  await page.route("**/api/v1/admin/equipments", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
  });
  await page.route("**/api/v1/admin/exercises**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "success", data: [], total: 0 }) });
  });
  await page.route("**/api/v1/admin/pricing-plans", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "success", data: [] }) });
  });

  await page.goto("/app");
  await page.getByPlaceholder("email@contoh.com").fill("admin@fitai.local");
  await page.getByPlaceholder("••••••••").fill("password123");
  await page.getByRole("button", { name: "MASUK" }).click();

  await expect(page.getByText("FITAI").first()).toBeVisible();
  await page.goto("/app#/admin/dashboard");
  await expect(page.getByText("CONTROL CENTER")).toBeVisible();

  await page.goto("/app#/admin/equipments");
  await expect(page.getByRole("button", { name: "+ TAMBAH" })).toBeVisible();

  await page.goto("/app#/admin/exercises");
  await expect(page.getByRole("button", { name: "+ TAMBAH" })).toBeVisible();

  await page.goto("/app#/admin/pricing");
  await expect(page.getByRole("button", { name: "+ TAMBAH" })).toBeVisible();
});
