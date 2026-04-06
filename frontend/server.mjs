import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT || 3000);
const backendPort = Number(process.env.BACKEND_PORT || 3005);
const backendHost = process.env.BACKEND_HOST || "localhost";
const backendBaseUrl = `http://${backendHost}:${backendPort}`;
const indexPath = path.resolve(__dirname, "../backend/public/index.html");

function proxyRequest(req, res) {
  const target = new URL(req.url, backendBaseUrl);
  const headers = { ...req.headers, host: `${backendHost}:${backendPort}` };

  const proxy = http.request(
    {
      hostname: backendHost,
      port: backendPort,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxy.on("error", (error) => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: "No se pudo conectar con el backend.",
        details: error.message,
        backendBaseUrl,
      })
    );
  });

  req.pipe(proxy);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  if (req.url.startsWith("/api/") || req.url === "/health") {
    proxyRequest(req, res);
    return;
  }

  if (req.url === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const html = await readFile(indexPath, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`No se pudo cargar la UI del frontend: ${error.message}`);
  }
});

server.listen(port, () => {
  console.log(`Frontend running on http://localhost:${port}`);
  console.log(`Proxying API requests to ${backendBaseUrl}`);
});
