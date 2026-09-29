const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  '/src/app.js': ['src/app.js', 'text/javascript; charset=utf-8'],
  '/src/styles.css': ['src/styles.css', 'text/css; charset=utf-8']
};

const port = Number(process.env.PORT) || 8000;
http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const entry = files[pathname];
  if (!entry) {
    response.writeHead(404).end('Not found');
    return;
  }
  const [file, type] = entry;
  response.setHeader('Content-Type', type);
  fs.createReadStream(path.join(__dirname, file))
    .on('error', () => response.writeHead(500).end('Server error'))
    .pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Откройте http://localhost:${port}`);
});
