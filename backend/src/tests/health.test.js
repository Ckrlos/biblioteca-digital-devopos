const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../server');

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const { port } = server.address();
      try {
        await fn(`http://127.0.0.1:${port}`);
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

test('GET /health responde 200 con status ok', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: 'ok' });
  });
});

test('GET /ruta-inexistente responde 404', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/ruta-inexistente`);
    assert.equal(res.status, 404);
  });
});
