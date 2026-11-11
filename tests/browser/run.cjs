// Runs every browser test against a copy of the site served from this folder.
//
//   npm run test:browser                 all tests
//   npm run test:browser -- undo         only tests whose file name contains "undo"
//
// Needs Playwright with Chromium (already installed in the Claude cloud environment).
// The tests never talk to the real Google Sheet: each one answers the sheet's requests with a stand-in.
// Screenshots go to tests/browser/screenshots/ (not saved in git).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function run(file, base) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(__dirname, file)], { env: { ...process.env, BASE: base } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ file, code, out, secs: Math.round((Date.now() - started) / 1000) }));
  });
}

(async () => {
  const filter = process.argv[2] || '';
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.cjs') && f.includes(filter)).sort();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  let failed = 0;
  for (const file of files) {
    process.stdout.write(`${file.padEnd(34)} `);
    const r = await run(file, base);
    const summary = (r.out.match(/(\d+\/\d+) checks passed/) || [])[1] || 'no summary';
    console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${summary}  (${r.secs}s)`);
    if (r.code !== 0) {
      failed++;
      console.log(r.out.split('\n').filter((l) => /FAIL|ERROR/.test(l)).map((l) => `    ${l.trim()}`).join('\n'));
    }
  }
  server.close();
  console.log(failed ? `\n${failed} of ${files.length} browser tests failed` : `\nAll ${files.length} browser tests passed`);
  process.exit(failed ? 1 : 0);
})();
