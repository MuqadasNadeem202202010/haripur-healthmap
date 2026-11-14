// Sirf local test ke liye: public/ files serve karta hai aur /api/facilities chalata hai
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const handler = require('./api/facilities.js');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname === '/api/facilities') {
    req.query = u.query;
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    return handler(req, res);
  }
  const f = path.join(__dirname, 'public', u.pathname === '/' ? 'index.html' : u.pathname);
  fs.readFile(f, (e, d) => {
    if (e) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', types[path.extname(f)] || 'text/plain');
    res.end(d);
  });
}).listen(3000, () => console.log('Server chal gaya: http://localhost:3000'));