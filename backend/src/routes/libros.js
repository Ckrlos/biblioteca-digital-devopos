const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /api/libros
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM libros ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar libros', detail: err.message });
  }
});

// POST /api/libros
router.post('/', async (req, res) => {
  const { titulo, autor, isbn, stock_total } = req.body;
  if (!titulo || !autor || !isbn || stock_total === undefined) {
    return res.status(400).json({ error: 'titulo, autor, isbn y stock_total son requeridos' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO libros (titulo, autor, isbn, stock_total, stock_disponible) VALUES (?, ?, ?, ?, ?)',
      [titulo, autor, isbn, stock_total, stock_total]
    );
    const [rows] = await pool.query('SELECT * FROM libros WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un libro con ese ISBN' });
    }
    res.status(500).json({ error: 'Error al crear libro', detail: err.message });
  }
});

// PUT /api/libros/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, autor, isbn, stock_total, stock_disponible } = req.body;
  try {
    const [existing] = await pool.query('SELECT * FROM libros WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }
    const libro = existing[0];
    await pool.query(
      'UPDATE libros SET titulo = ?, autor = ?, isbn = ?, stock_total = ?, stock_disponible = ? WHERE id = ?',
      [
        titulo ?? libro.titulo,
        autor ?? libro.autor,
        isbn ?? libro.isbn,
        stock_total ?? libro.stock_total,
        stock_disponible ?? libro.stock_disponible,
        id,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM libros WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar libro', detail: err.message });
  }
});

// DELETE /api/libros/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM libros WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar libro', detail: err.message });
  }
});

module.exports = router;
