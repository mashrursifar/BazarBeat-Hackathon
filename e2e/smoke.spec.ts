import { expect, test } from "@playwright/test";

test("home page shows the BazarBeat promise", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /better price/i })).toBeVisible();
});
