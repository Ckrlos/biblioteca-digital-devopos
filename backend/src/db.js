const mysql = require('mysql2/promise');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'biblioteca',
} = process.env;

const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// El contenedor de la app puede arrancar antes que MySQL este listo para
// aceptar conexiones (docker-compose y Kubernetes no garantizan el orden),
// por lo que reintentamos con backoff en vez de fallar de inmediato.
async function waitForDatabase({ retries = 15, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const connection = await pool.getConnection();
      connection.release();
      console.log(`[db] Conexion a MySQL establecida (intento ${attempt})`);
      return;
    } catch (err) {
      console.warn(
        `[db] Intento ${attempt}/${retries} fallido al conectar a MySQL: ${err.message}`
      );
      if (attempt === retries) {
        throw new Error('No se pudo conectar a MySQL despues de varios intentos');
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { pool, waitForDatabase };
