const base = process.argv[2] || "http://localhost:3000";
const routes = [["/", false], ["/login", false], ["/api/auth/session", true], ["/api/auth/providers", true]];
let failures = 0;
for (const [path, json] of routes) {
  try {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000), redirect: "manual" });
    if (response.status !== 200) throw new Error(`HTTP ${response.status}; restart with npm run dev:clean after stopping the current server.`);
    if (json) {
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Expected JSON but received HTML. The auth route is not being served correctly.");
      const data = await response.json();
      if (!data || typeof data !== "object") throw new Error("Auth route returned an invalid JSON response.");
    } else {
      const html = await response.text();
      if (!html.includes("SiteCraft AI")) throw new Error("The response is not the SiteCraft application.");
    }
    console.log(`OK GET ${path}: 200 ${json ? "JSON" : "HTML"}`);
  } catch (error) {
    failures += 1;
    console.error(`FAILED GET ${path}: ${error.message}`);
  }
}
process.exitCode = failures ? 1 : 0;
