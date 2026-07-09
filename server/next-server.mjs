import { createServer } from "node:http";
import next from "next";
import { acknowledgeBlock, getResource, replayFailure } from "../lib/warden-state.js";

const dev = process.env.NODE_ENV !== "production";
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const app = next({ dev, dir: process.cwd(), hostname: host, port });
const handle = app.getRequestHandler();

await app.prepare();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const nextUrl = {
      href: `${url.pathname}${url.search}`,
      path: `${url.pathname}${url.search}`,
      pathname: url.pathname,
      query: Object.fromEntries(url.searchParams),
      search: url.search
    };
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname.replace(/^\/api\//, ""));
      return;
    }
    if (url.pathname === "/") {
      await app.render(req, res, "/", nextUrl.query);
      return;
    }
    await handle(req, res, nextUrl);
  } catch (error) {
    sendJson(res, 500, { error: "internal_error", message: error.message });
  }
}).listen(port, host, () => {
  console.log(`Warden Next dashboard running at http://${host}:${port}`);
});

async function handleApi(req, res, path) {
  if (req.method === "GET") {
    const resource = await getResource(path);
    if (resource === undefined || resource === null) return sendJson(res, 404, { error: "not_found" });
    return sendJson(res, 200, resource);
  }

  if (req.method === "POST" && path === "replay-failure") {
    return sendJson(res, 200, await replayFailure());
  }

  if (req.method === "POST" && path === "acknowledge") {
    return sendJson(res, 200, await acknowledgeBlock());
  }

  sendJson(res, 404, { error: "not_found" });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
