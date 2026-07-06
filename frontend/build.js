const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(srcDir, 'app.js')],
  bundle: true,
  minify: true,
  outfile: path.join(distDir, 'app.js'),
  target: ['es2020'],
});

esbuild.buildSync({
  entryPoints: [path.join(srcDir, 'styles.css')],
  minify: true,
  outfile: path.join(distDir, 'styles.css'),
});

// config.js se copia sin bundlear: se reemplaza en runtime (por ejemplo,
// desde un ConfigMap) sin necesidad de reconstruir la imagen.
fs.copyFileSync(path.join(srcDir, 'config.js'), path.join(distDir, 'config.js'));
fs.copyFileSync(path.join(srcDir, 'index.html'), path.join(distDir, 'index.html'));

console.log('[build] Frontend bundleado en dist/');
