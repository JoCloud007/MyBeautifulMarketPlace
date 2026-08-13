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

  if (req.url.startsWith('/api/')) {
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
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API unavailable', message: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  // Serve static files from dist/
  let filePath = path.join(__dirname, 'dist', req.url.slice(1));
  if (req.url === '/' || !path.extname(req.url)) {
    filePath = path.join(__dirname, 'dist', 'index.html');
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
  console.log(`[WEB] Proxying /api/* to http://${API_HOST}:${API_PORT}`);
});
