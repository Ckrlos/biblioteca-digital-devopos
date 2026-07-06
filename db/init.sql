-- Script de inicializacion de la base de datos "Biblioteca Digital".
-- Se monta en /docker-entrypoint-initdb.d/ y MySQL lo ejecuta automaticamente
-- solo la primera vez que el volumen de datos esta vacio.

CREATE TABLE IF NOT EXISTS libros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  autor VARCHAR(255) NOT NULL,
  isbn VARCHAR(50) NOT NULL UNIQUE,
  stock_total INT NOT NULL DEFAULT 0,
  stock_disponible INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prestamos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  libro_id INT NOT NULL,
  nombre_usuario VARCHAR(255) NOT NULL,
  fecha_prestamo DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_devolucion_estimada DATE NOT NULL,
  fecha_devolucion_real DATETIME NULL,
  estado ENUM('prestado', 'devuelto') NOT NULL DEFAULT 'prestado',
  CONSTRAINT fk_prestamos_libro FOREIGN KEY (libro_id) REFERENCES libros(id)
);

INSERT INTO libros (titulo, autor, isbn, stock_total, stock_disponible) VALUES
  ('Cien anios de soledad', 'Gabriel Garcia Marquez', '978-0307474728', 5, 5),
  ('1984', 'George Orwell', '978-0451524935', 4, 4),
  ('El principito', 'Antoine de Saint-Exupery', '978-0156012195', 6, 6),
  ('Fahrenheit 451', 'Ray Bradbury', '978-1451673319', 3, 3),
  ('Rayuela', 'Julio Cortazar', '978-8437604572', 2, 2),
  ('Crimen y castigo', 'Fiodor Dostoyevski', '978-0143107637', 4, 4);
