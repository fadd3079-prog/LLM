import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.');
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm' };
http.createServer(async (req, res) => {
    try {
        const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403).end(); return; }
        const file = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }).end(data);
    } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`AI Workspace: http://localhost:${port}`));
