import { expect, setUpHousehold, test } from "./fixtures";

test("a new Learner picks an Avatar and colour at their first login, lands on Today, and isn't asked again", async ({ page }) => {
  await setUpHousehold(page.request, [{ name: "Ada", avatar: null }]);
  await page.goto("/");
  // Until the first pick, the profile shows Ada's initial.
  await expect(page.getByRole("button", { name: "Ada" }).getByText("A", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ada" }).click();

  await expect(page.getByRole("heading", { name: "Make it yours, Ada." })).toBeVisible();
  // A sibling who tapped the wrong profile can leave without picking.
  await page.getByRole("button", { name: "Not Ada? Switch profile" }).click();
  await expect(page.getByRole("heading", { name: "Who's learning today?" })).toBeVisible();
  await page.getByRole("button", { name: "Ada" }).click();
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
