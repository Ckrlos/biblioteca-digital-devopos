const express = require('express');
const cors = require('cors');
const client = require('prom-client');

const { waitForDatabase } = require('./db');
const librosRouter = require('./routes/libros');
const prestamosRouter = require('./routes/prestamos');

const PORT = process.env.PORT || 3001;

const app = express();

app.use(cors());
app.use(express.json());

// Metricas Prometheus (observabilidad) - contadores por defecto de Node.js
// mas un contador simple de requests HTTP por ruta/metodo/status.
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requests HTTP recibidos',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.route ? req.baseUrl + req.route.path : req.path,
      status_code: res.statusCode,
    });
  });
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/libros', librosRouter);
app.use('/api/prestamos', prestamosRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

async function start() {
  await waitForDatabase();
  app.listen(PORT, () => {
    console.log(`[server] Biblioteca Digital backend escuchando en el puerto ${PORT}`);
  });
}

// Evita levantar el servidor automaticamente durante los tests unitarios.
if (require.main === module) {
  start().catch((err) => {
    console.error('[server] Error fatal al iniciar:', err);
    process.exit(1);
  });
}

module.exports = app;
