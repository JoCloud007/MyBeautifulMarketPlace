import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_HOST = process.env.API_HOST || 'api';
const API_PORT = process.env.API_PORT || '3001';
const PORT = process.env.PORT || '5192';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy the MCP endpoint(s) to the API container too, so MCP clients can
  // use the SAME origin as the web app (the status page advertises
  // <origin>/mcp). POST /mcp carries its own Bearer gate; /sse and /messages
  // are the opt-in legacy fallback (404 while MCP_ENABLE_SSE is off).
  // /mcp matches the MCP endpoint EXACTLY or with sub-paths (/mcp/) — some
  // clients (opencode) call /mcp/ with a trailing slash; an exact match
  // would fall through to the SPA fallback and answer text/html. But the
  // internal page /mcp-status must stay OUT of the proxy (it is served by
  // the SPA), hence the boundary check on the next character.
  const isMcpEndpoint = /^\/mcp(\/|\?|$)/.test(req.url);
  if (req.url.startsWith('/api/') || isMcpEndpoint || req.url.startsWith('/sse') || req.url.startsWith('/messages')) {
    // Proxy to API container
    const options = {
      hostname: API_HOST,
      port: parseInt(API_PORT, 10),
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${API_HOST}:${API_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[PROXY ERROR] ${req.method} ${req.url} -> ${API_HOST}:${API_PORT}: ${err.message}`);
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API unavailable', message: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  // Serve static files from dist/ (path-traversal-safe)
  // Strip the query string and hash BEFORE resolving: req.url keeps them
  // (e.g. "/assets/app.js?v=123"), and a path containing "?" makes
  // fs.readFile fail → the SPA fallback would answer text/html for a JS
  // asset (the exact failure class the MCP proxy routing fixes).
  const distRoot = path.join(__dirname, 'dist');
  const pathname = req.url.split('?')[0].split('#')[0];
  let filePath = path.join(distRoot, pathname.slice(1));
  if (pathname === '/' || !path.extname(pathname)) {
    filePath = path.join(distRoot, 'index.html');
  }
  if (path.normalize(filePath) !== filePath || !path.normalize(filePath).startsWith(distRoot + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: serve index.html for unknown routes
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      fs.readFile(indexPath, (err2, indexData) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(indexData);
        }
      });
    } else {
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(parseInt(PORT, 10), '0.0.0.0', () => {
  console.log(`[WEB] Server listening on http://0.0.0.0:${PORT}`);
  console.log(`[WEB] Proxying /api/*, /mcp, /sse, /messages to http://${API_HOST}:${API_PORT}`);
});
