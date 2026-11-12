// SafeZone · recolor.js
// Uso:  node recolor.js <archivo1> <archivo2> ...
// Cambia la paleta azul -> verde (estilo SafeZone nuevo) sin tocar la lógica.
const fs = require('fs');

const HEX = {
  '#07090f': '#0a0a0a',  // fondo
  '#0d1117': '#111111',  // superficie
  '#111820': '#1a1a1a',  // inputs
  '#1e2530': '#222222',  // bordes
  '#1a6bff': '#2ECC71',  // acento
  '#0f4fc2': '#27AE60',
  '#7ab4ff': '#58D68D',  // acento claro
  '#30e890': '#27AE60',  // riesgo bajo / éxito
  '#ff3737': '#E74C3C',  // riesgo alto / peligro
  '#ffbb30': '#E67E22',  // riesgo medio
  '#e0e8f0': '#FFFFFF',  // texto
  '#8899aa': '#999999',  // texto secundario
};

// rgba(r,g,b,...) viejo -> nuevo
const RGB = {
  '26,107,255':  '46,204,113',
  '0,100,255':   '46,204,113',
  '255,55,55':   '231,76,60',
  '48,232,144':  '39,174,96',
  '255,187,48':  '230,126,34',
  '7,9,15':      '10,10,10',
  '13,17,23':    '17,17,17',
};

for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(file)) { console.log('No existe:', file); continue; }
  let src = fs.readFileSync(file, 'utf8');
  let n = 0;

  src = src.replace(/#[0-9a-fA-F]{6}\b/g, m => {
    const to = HEX[m.toLowerCase()];
    if (to) { n++; return to; }
    return m;
  });

  src = src.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/g, (m, r, g, b) => {
    const to = RGB[`${r},${g},${b}`];
    if (to) { n++; return `rgba(${to},`; }
    return m;
  });

  fs.writeFileSync(file, src);
  console.log(`✓ ${file}  (${n} cambios)`);
}