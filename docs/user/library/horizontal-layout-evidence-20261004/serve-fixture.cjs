const http = require('http'), fs = require('fs'), path = require('path');
const routes = { '/': ['fixture.html', 'text/html'], '/fixture.bundle.js': ['fixture.bundle.js', 'application/javascript'] };
const server = http.createServer((request, response) => {
    const route = routes[request.url];
    if (!route) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': route[1] + '; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(path.join(__dirname, route[0])).pipe(response);
});
server.listen(19010, '127.0.0.1', () => console.log('Isolated fixture on 19010'));
