const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /api/prestamos
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, l.titulo AS libro_titulo
       FROM prestamos p
       JOIN libros l ON l.id = p.libro_id
       ORDER BY p.id DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar prestamos', detail: err.message });
  }
});

// POST /api/prestamos - crea un prestamo y descuenta stock_disponible
router.post('/', async (req, res) => {
  const { libro_id, nombre_usuario, fecha_devolucion_estimada } = req.body;
  if (!libro_id || !nombre_usuario || !fecha_devolucion_estimada) {
    return res.status(400).json({
      error: 'libro_id, nombre_usuario y fecha_devolucion_estimada son requeridos',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [libros] = await connection.query(
      'SELECT * FROM libros WHERE id = ? FOR UPDATE',
      [libro_id]
    );
    if (libros.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Libro no encontrado' });
    }
    if (libros[0].stock_disponible <= 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'No hay stock disponible para este libro' });
    }

    await connection.query(
      'UPDATE libros SET stock_disponible = stock_disponible - 1 WHERE id = ?',
      [libro_id]
    );

    const [result] = await connection.query(
      `INSERT INTO prestamos (libro_id, nombre_usuario, fecha_devolucion_estimada, estado)
       VALUES (?, ?, ?, 'prestado')`,
      [libro_id, nombre_usuario, fecha_devolucion_estimada]
    );

    await connection.commit();

    const [rows] = await pool.query('SELECT * FROM prestamos WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Error al crear prestamo', detail: err.message });
  } finally {
    connection.release();
  }
});

// PUT /api/prestamos/:id/devolver - marca devuelto y repone stock
router.put('/:id/devolver', async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [prestamos] = await connection.query(
      'SELECT * FROM prestamos WHERE id = ? FOR UPDATE',
      [id]
    );
    if (prestamos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Prestamo no encontrado' });
    }
    if (prestamos[0].estado === 'devuelto') {
      await connection.rollback();
      return res.status(409).json({ error: 'El prestamo ya fue devuelto' });
    }

    await connection.query(
      `UPDATE prestamos SET estado = 'devuelto', fecha_devolucion_real = NOW() WHERE id = ?`,
      [id]
    );
    await connection.query(
      'UPDATE libros SET stock_disponible = stock_disponible + 1 WHERE id = ?',
      [prestamos[0].libro_id]
    );

    await connection.commit();

    const [rows] = await pool.query('SELECT * FROM prestamos WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Error al devolver prestamo', detail: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
