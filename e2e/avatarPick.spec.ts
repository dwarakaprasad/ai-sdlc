import { expect, setUpHousehold, test } from "./fixtures";

test("a new Learner picks an Avatar and colour at their first login, lands on Today, and isn't asked again", async ({ page }) => {
  await setUpHousehold(page.request, [{ name: "Ada", avatar: null }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Ada" }).click();

  await expect(page.getByRole("heading", { name: "Make it yours, Ada." })).toBeVisible();
  // Done waits for a picture.
  await expect(page.getByRole("button", { name: "Done" })).toBeDisabled();
  await expect(page.getByRole("radio")).toHaveCount(16 + 8);
  await page.getByRole("radio", { name: "Penguin" }).check();
  await page.getByRole("radio", { name: "Mint" }).check();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ada!" })).toBeVisible();

  // Next time, straight to Today.
  await page.getByRole("button", { name: "Switch profile" }).click();
  await page.getByRole("button", { name: "Ada" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ada!" })).toBeVisible();
});
