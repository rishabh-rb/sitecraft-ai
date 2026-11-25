import assert from "node:assert/strict";
import test from "node:test";
import { createLaunchReport, createLocalCode, createLocalContent, createLocalDesign, createLocalPlan } from "@sitecraft/ml";

test("traces actual restaurant preview evidence and flags unpublished review content", () => {
  const brief = "Create a responsive restaurant website with a menu, a reservation form, customer reviews, and no pricing.";
  const plan = createLocalPlan(brief);
  const content = createLocalContent(plan, brief);
  const site = createLocalCode(plan, createLocalDesign(plan), content);
  const report = createLaunchReport(site, [brief], ["Netlify"]);
  const status = (label: string) => report.requirements.find((item) => item.label === label)?.status;

  assert.deepEqual(content.testimonials, []);
  assert.deepEqual(report.claims, []);
  assert.equal(status("Restaurant menu"), "covered");
  assert.equal(status("Reservation form"), "covered");
  assert.equal(status("Mobile responsive"), "covered");
  assert.equal(status("Pricing"), "omitted");
  assert.equal(status("Customer reviews"), "partial");
  assert.deepEqual(report.coverage, { covered: 4, total: 5 });
  assert.equal(report.checks.find((item) => item.label === "Contrast check")?.status, "pass");
  assert.equal(report.checks.find((item) => item.label === "Form interaction check")?.status, "review");
  assert.ok(site.html.includes("No message was sent"));
  assert.ok(report.checklist.some((item) => item.label === "README created" && item.status === "pass"));
  assert.ok(report.checklist.some((item) => item.label === "Deployment configuration" && item.detail.includes("Netlify")));
});

test("flags source problems and honors a later brief without treating hidden markup as coverage", () => {
  const report = createLaunchReport({
    html: '<html lang="en"><head><title>Studio</title></head><body style="color:#888888;background:#999999"><main><h1>Studio</h1><section id="pricing" hidden>Pricing</section><a href="#missing">Read more</a><form><input required></form><p>Trusted by 10,000+ customers</p><p>Lorem ipsum</p></main></body></html>',
    files: [{ path: "src/App.tsx", language: "tsx", content: "const headline = 'Award-winning team';" }]
  }, ["Build a studio site with pricing and a gallery.", "Remove pricing."]);
  const statuses = Object.fromEntries(report.checks.map((item) => [item.label, item.status]));

  assert.equal(report.requirements.find((item) => item.label === "Pricing")?.status, "omitted");
  assert.equal(report.requirements.find((item) => item.label === "Photo gallery")?.status, "missing");
  assert.equal(statuses["Accessibility score"], "fail");
  assert.equal(statuses["Contrast check"], "fail");
  assert.equal(statuses["Broken-link check"], "fail");
  assert.equal(statuses["Form interaction check"], "fail");
  assert.ok(report.claims.some((claim) => claim.includes("10,000")));
  assert.ok(report.claims.includes("Award-winning"));
  assert.ok(report.missingContent.some((warning) => warning.includes("Lorem ipsum")));
  assert.ok(report.score < 50);
});
