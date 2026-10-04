// demo.spec.ts: judge-path smoke coverage for legal notices, navigation, search and responsive layout.
import { expect, test, type Page } from "@playwright/test";

const routes = ["/", "/dashboard", "/dashboard?tab=tests", "/dashboard?tab=method"];

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
}

for (const route of routes) {
  test(`${route} carries the legal and date context`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(route);
    await expect(page.locator(".rr-advice")).toContainText(/not legal advice/i);
    await expect(page.locator("#rr-asof")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("address search is keyboard operable and keeps evidence context", async ({ page }) => {
  await page.goto("/dashboard");
  const search = page.getByRole("combobox", { name: "Find a sample address" });
  await search.fill("A0005");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await search.press("Enter");

  await expect(page).toHaveURL(/a=A0005/);
  await expect(page.getByText(/Sample ID.*A0005/)).toBeVisible();
  await expect(page.locator(".rr-sum-stamp")).toContainText(/not legal advice/i);
  await expect(page.locator(".rr-sum-stamp time")).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}/);
});

test("language selection persists in the URL", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(page).toHaveURL(/lang=es/);
  await expect(page.locator(".rr-advice")).toContainText(/asesor[ií]a legal/i);
});

test("a dated demo scenario updates the address and global as-of date", async ({ page }) => {
  await page.goto("/dashboard");
  const scenario = page.locator(".rr-sc-card").filter({ hasText: "T1" });
  await expect(scenario).toBeVisible();
  const picks = scenario.locator(".rr-sc-pick");
  await expect(picks).toHaveCount(2);

  await picks.first().click();
  await expect(page).toHaveURL(/asOf=2025-12-31/);
  await expect(page.locator("#rr-asof")).toHaveValue("2025-12-31");

  await page.locator(".rr-sc-compact summary").click();
  const compactPicks = page.locator(".rr-sc-compact-group").filter({ hasText: "T1" }).locator(".rr-sc-pick");
  await compactPicks.last().click();
  await expect(page).toHaveURL(/asOf=2026-01-02/);
  await expect(page.locator("#rr-asof")).toHaveValue("2026-01-02");
});

test("rule cards expose evidence, retrieval date and legal context", async ({ page }) => {
  await page.goto("/dashboard?a=A0005");
  const rule = page.getByRole("article").first();
  await expect(rule.getByRole("blockquote")).toBeVisible();
  await expect(rule).toContainText(/Retrieved/);
  await expect(rule.getByRole("link", { name: /Open source/ })).toHaveAttribute("target", "_blank");
  await expect(rule.locator("time")).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}/);
  await expect(rule).toContainText(/Not legal advice/i);
});

test("evaluated states render summaries, readable reasons, conflicts and supersession", async ({ page }) => {
  await page.route("**/data/manifest.json", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    manifest.lookup_dates = Array.from(new Set([...(manifest.lookup_dates ?? []), "2026-10-01"]));
    await route.fulfill({ response, json: manifest });
  });
  await page.route("**/data/lookups/2026-10-01.json", async (route) => {
    await route.fulfill({
      json: {
        as_of: "2026-10-01",
        lookups: {
          A0005: [
            { team_rule_id: "r-D006-01", result: "applies", explanation: "The local annual adjustment rule applies.", conflict_flag: false },
            { team_rule_id: "r-D024-01", result: "superseded", explanation: "The Berkeley rule displaces the state rule.", reason: "superseded_by:r-D006-01", conflict_flag: false },
            { team_rule_id: "r-D001-01", result: "unknown", explanation: "A required building fact is unavailable.", reason: "missing_year_built", conflict_flag: true },
            { team_rule_id: "r-D022-01", result: "pending", explanation: "This test fixture exercises a pending result.", conflict_flag: false },
          ],
        },
      },
    });
  });

  await page.goto("/dashboard?a=A0005");
  const summary = page.getByRole("region", { name: "At a glance" });
  await expect(summary).toContainText("Applies");
  await expect(summary).toContainText("Unknown");
  await expect(summary).toContainText("Superseded");
  await expect(summary).toContainText("Pending");
  await expect(summary).toContainText("Needs human review");

  const unknown = page.getByRole("article", { name: /Prohibition on the Sale or Use/ });
  await expect(unknown).toContainText("year built is missing");
  await expect(unknown).toContainText("Needs human review");

  const localRule = page.getByRole("article", { name: /Annual General Adjustment capped/ });
  await localRule.locator(".rr-displaced summary").click();
  await expect(localRule).toContainText("The Berkeley rule displaces the state rule.");
  await expect(localRule).toContainText("superseded by r-D006-01");
});

test("the landing stage replays address × date and hands control to the visitor", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stage = page.locator(".rr-stage");
  await expect(stage).toBeVisible();
  // Reduced motion: no autoplay.
  await expect(stage.getByRole("button", { name: "Play" })).toHaveAttribute("aria-pressed", "false");
  await expect(stage.locator(".rr-stage-foot")).toContainText(/not legal advice/i);

  const dates = stage.locator(".rr-scrub button");
  await dates.last().click();
  await expect(page).toHaveURL(/asOf=2027-07-02/);
  await expect(page.locator("#rr-asof")).toHaveValue("2027-07-02");
  await expect(stage.locator(".rr-stage-foot time")).toHaveAttribute("datetime", "2027-07-02");

  await stage.locator(".rr-stage-tabs button").nth(1).click();
  await expect(stage.locator(".rr-stage-tabs button").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(stage.locator(".rr-stage-foot a")).toHaveAttribute("href", /tab=lookup&a=A\d{4}/);
});

test("change-test timeline opens the picked test", async ({ page }) => {
  await page.goto("/dashboard?tab=tests");
  const lane = page.locator(".rr-tl-lane").filter({ hasText: "T3" });
  await lane.click();
  await expect(page).toHaveURL(/t=T3/);
  await expect(lane).toHaveAttribute("aria-current", "true");
  await expect(page.locator("#test-T3 .rr-test-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#test-T1 .rr-test-toggle")).toHaveAttribute("aria-expanded", "false");
});

test("method tab draws the pipeline with counts from the data", async ({ page }) => {
  await page.goto("/dashboard?tab=method");
  const pipe = page.getByRole("figure", { name: /From public text/ });
  await expect(pipe).toContainText(/\d+ public documents/);
  await expect(pipe).toContainText(/\d+ rules kept/);
  await expect(pipe).toContainText("Deterministic engine");
});

test("an address shows its approximate location and its results on every date", async ({ page }) => {
  await page.goto("/dashboard?a=A0002&asOf=2026-10-01");
  const where = page.getByRole("region", { name: "Where and when" });
  await expect(where.locator(".rr-map svg")).toBeVisible();
  await expect(where.locator(".rr-map-pin")).toHaveCount(1);
  const rows = where.locator(".rr-dchart-rows button");
  await expect(rows).toHaveCount(4);
  await rows.last().click();
  await expect(page).toHaveURL(/asOf=2027-07-02/);
});

test("an open change test shows KPI tiles and a map of affected addresses", async ({ page }) => {
  await page.goto("/dashboard?tab=tests&t=T2");
  const card = page.locator("#test-T2");
  await expect(card.locator(".rr-kpis")).toContainText("Affected addresses");
  await expect(card.locator(".rr-dot.is-flag").first()).toBeVisible();
  await expect(page.locator("#test-T1 .rr-test-body")).toBeHidden();
});
