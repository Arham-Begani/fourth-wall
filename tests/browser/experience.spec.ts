import { test, expect } from "@playwright/test";

test("connection guide contains exact registration fields and builds the correct OAuth request", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Set up my channel", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Confidential");
  await expect(dialog).toContainText("two-factor authentication");
  const origin = new URL(page.url()).origin;
  await expect(dialog.getByTestId("redirect-url")).toHaveText(origin + "/");
  await dialog.getByLabel("Twitch Client ID", { exact: true }).fill("short");
  await expect(
    dialog.getByRole("button", { name: "Continue to Twitch" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Twitch Client ID", { exact: true })
    .fill("fourthwalltestclient12345");
  await page.route("https://id.twitch.tv/oauth2/authorize?**", (route) =>
    route.fulfill({
      body: "Mock authorization endpoint. No Twitch account accessed.",
    }),
  );
  await dialog.getByRole("button", { name: "Continue to Twitch" }).click();
  await page.waitForURL("https://id.twitch.tv/oauth2/authorize?**");
  const url = new URL(page.url());
  expect(url.searchParams.get("client_id")).toBe("fourthwalltestclient12345");
  expect(url.searchParams.get("redirect_uri")).toBe(origin + "/");
  expect(url.searchParams.get("scope")).toBe("user:read:chat");
  expect(url.searchParams.get("response_type")).toBe("token");
  expect(url.searchParams.get("state")).toMatch(/^[a-z0-9-]{36}$/);
  expect(url.searchParams.has("client_secret")).toBe(false);
});

test("scene preferences, name visibility, crowd reactions and touch tilt controls work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("caught-count")).not.toHaveText("00");
  await page.getByRole("button", { name: "Orbit", exact: true }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-scene", "orbit");
  await page.getByRole("button", { name: "Hearts", exact: true }).click();
  await expect(
    page.getByText("sent some love", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Viewer names on", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Viewer names off", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Orbit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("caught-count")).not.toHaveText("00");
  await page
    .getByRole("button", { name: "Tilt selected palm right", exact: true })
    .click();
  await expect(
    page.locator(".session-line").filter({ hasText: "Missed arrivals" }),
  ).not.toContainText("0");
  await page
    .getByRole("button", { name: "Level selected palm", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../outputs/fourth-wall-mobile-controls.png",
  });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "../../outputs/fourth-wall-mobile-hero.png" });
});

test("rescue run clock pauses, finishes, stores a device best and restarts", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start 60-second run", exact: true })
    .click();
  await page.clock.runFor(2000);
  await expect(page.getByTestId("score-count")).not.toHaveText("0");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(300);
  const paused = await page.getByTestId("round-clock").innerText();
  await page.clock.runFor(5000);
  await expect(page.getByTestId("round-clock")).toHaveText(paused);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.fastForward(61000);
  await expect(
    page.getByRole("heading", { name: "That's a wrap." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Number(localStorage.getItem("fw.best-score"))),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(page.getByTestId("round-clock")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exit run", exact: true }),
  ).toBeVisible();
});

test("landing explains viewer commands and opens accessible FAQ answers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByText("Do viewers need to install anything?", { exact: true })
    .click();
  await expect(page.locator("details[open]")).toContainText(
    "!wave, !heart and !spin",
  );
  await page.getByRole("button", { name: "Twitch setup", exact: true }).click();
  await expect(page.locator("#twitch-setup")).toBeInViewport();
  expect(errors).toEqual([]);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "../../outputs/fourth-wall-upgraded-landing.png",
    fullPage: true,
  });
});
