import express from "express";
import httpProxy from "http-proxy";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const production = process.argv.includes("--production");
const port = Number(process.env.PORT || (production ? 3000 : 5173));
const backend = process.env.API_ORIGIN || "http://localhost:8080";
const apiBaseUrl = `${backend.replace(/\/$/, "")}/api`;
const app = express();
app.disable("x-powered-by");
const vite = production ? undefined : await (await import("vite")).createServer({
  root,
  server: { middlewareMode: true },
  appType: "custom",
});
const template = production ? await readFile(path.join(root, "dist/client/index.html"), "utf8") : undefined;
const manifest = production ? JSON.parse(await readFile(path.join(root, "dist/client/.vite/ssr-manifest.json"), "utf8")) : {};
const renderer = production ? await import("../dist/server/entry-server.js") : undefined;

app.get("/healthz", (_req, res) => res.type("text").send("ok"));
const proxy = httpProxy.createProxyServer({ target: backend, xfwd: true, proxyTimeout: 60_000 });
app.use((req, res, next) => {
  if (!["/api/", "/oauth2/", "/login/oauth2/"].some((prefix) => req.path.startsWith(prefix))) return next();
  proxy.web(req, res, (error) => {
    console.error("Backend proxy failed:", error.message);
    if (!res.headersSent) res.status(502).json({ code: "BACKEND_UNAVAILABLE" });
    else res.end();
  });
});
if (vite) app.use(vite.middlewares);
else app.use(express.static(path.join(root, "dist/client"), {
  index: false,
  dotfiles: "deny",
  setHeaders(res, filePath) {
    if (filePath.includes(`${path.sep}assets${path.sep}`))
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  },
}));

app.use(async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const url = new URL(req.originalUrl, "http://localhost");
  let html = template ?? await vite.transformIndexHtml(req.originalUrl, await readFile(path.join(root, "index.html"), "utf8"));
  if (url.pathname === "/blog" || url.pathname === "/blog/") {
    // The first page has one URL; subsequent pages retain their own query URL.
    const rawPage = url.searchParams.get("page");
    const validPage = rawPage !== null && /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) && Number(rawPage) > 1;
    const canonicalPage = validPage ? String(Number(rawPage)) : null;
    if (url.pathname.endsWith("/") || rawPage !== canonicalPage || url.searchParams.getAll("page").length > 1) {
      if (canonicalPage) url.searchParams.set("page", canonicalPage);
      else url.searchParams.delete("page");
      return res.redirect(301, `/blog${url.search}`);
    }
    try {
      const { render } = renderer ?? await vite.ssrLoadModule("/src/entry-server.ts");
      const result = await render(req.originalUrl, apiBaseUrl);
      const styles = [...new Set(result.modules.flatMap((id) => manifest[id] ?? []))]
        .filter((file) => file.endsWith(".css"))
        .map((file) => `<link rel="stylesheet" href="${file}">`).join("");
      html = html.replace(/<title>.*?<\/title>/, () => `<title>${result.title}</title>`)
        .replace("<!--app-head-->", () => result.head + styles)
        .replace("<!--app-html-->", () => result.html)
        .replace("<!--app-state-->", () => result.state);
      res.set("X-Robots-Tag", result.robots);
    } catch (error) {
      vite?.ssrFixStacktrace(error);
      console.error("Blog SSR failed:", error);
      // Do not let a temporary API outage turn an empty list into an indexed page.
      res.status(503).set({ "X-Robots-Tag": "noindex, nofollow", "Retry-After": "60" });
      html = html.replace("<!--app-head-->", '<meta name="robots" content="noindex, nofollow">');
    }
  }
  res.set("Cache-Control", "no-store").type("html").send(html);
});

const server = app.listen(port, process.env.HOST || "127.0.0.1", () => {
  console.log(`Codeiary listening on http://${process.env.HOST || "127.0.0.1"}:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  server.close(async () => { await vite?.close(); process.exit(0); });
});
