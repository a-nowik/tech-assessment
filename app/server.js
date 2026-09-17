'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { rebalance } = require('./src/rebalance');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 1024 * 1024;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve({ tooLarge, body: Buffer.concat(chunks).toString('utf8') }));
    req.on('error', reject);
  });
}

async function handleRebalance(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { errors: ['Method not allowed, use POST'] });
  }

  const { tooLarge, body } = await readBody(req);
  if (tooLarge) {
    return sendJson(res, 413, { errors: ['Request body is too large'] });
  }

  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return sendJson(res, 400, { errors: ['Request body must be valid JSON'] });
  }

  const outcome = rebalance(input);
  if (!outcome.ok) {
    return sendJson(res, 400, { errors: outcome.errors });
  }
  return sendJson(res, 200, outcome.result);
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  let relativePath;
  try {
    relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
  } catch {
    return sendNotFound(res);
  }

  const filePath = path.join(PUBLIC_DIR, relativePath);
  // Block path traversal outside the public folder (e.g. /../server.js).
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendNotFound(res);
  }

  let content;
  try {
    content = await fs.readFile(filePath);
  } catch {
    return sendNotFound(res);
  }

  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
  });
  res.end(req.method === 'HEAD' ? undefined : content);
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/rebalance') {
      return await handleRebalance(req, res);
    }
    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { errors: ['Not found'] });
    }
    return await serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      sendJson(res, 500, { errors: ['Internal server error'] });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Rebalancer running at http://localhost:${PORT}`);
});
