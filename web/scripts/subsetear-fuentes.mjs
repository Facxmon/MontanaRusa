// Genera public/fuentes/*.woff2: IBM Plex Sans (400, 500, 600) e IBM Plex
// Mono (400, 500) subseteadas a latin mas los simbolos que usa la interfaz.
//
// Origen de las fuentes completas: paquetes npm @ibm/plex-sans@1.1.0 y
// @ibm/plex-mono@1.1.0 (licencia OFL-1.1), archivos fonts/complete/woff2/.
// No se agregan como dependencia porque traen un postinstall de telemetria:
// se instalan en una carpeta aparte y se le pasa la ruta a este script.
//
//   npm install --prefix /tmp/plex @ibm/plex-sans@1.1.0 @ibm/plex-mono@1.1.0
//   node scripts/subsetear-fuentes.mjs /tmp/plex/node_modules/@ibm
//
// Plex no tiene ✕ ▶ ❚ ✗ (dingbats): esos caen al fallback del sistema, igual
// que antes. Los simbolos que si tiene (° · ↑ ↓ — ≤ ≥ × ✓ √ λ φ κ α − …) se
// conservan.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const origen = process.argv[2];
if (!origen) {
  console.error('Uso: node scripts/subsetear-fuentes.mjs <carpeta node_modules/@ibm>');
  process.exit(1);
}
const destino = fileURLToPath(new URL('../public/fuentes/', import.meta.url));
mkdirSync(destino, { recursive: true });

// Rangos "latin" (Basic Latin, Latin-1, puntuacion general, moneda) mas los
// simbolos sueltos de la interfaz y las letras griegas de los graficos.
const rangos = [
  [0x0020, 0x007e],
  [0x00a0, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x2000, 0x206f],
  [0x2074, 0x2074],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
];
const simbolos = '°·✕↑↓▶❚—≤≥×✓✗√λφκα−…';
let texto = simbolos;
for (const [desde, hasta] of rangos) for (let c = desde; c <= hasta; c++) texto += String.fromCodePoint(c);

const fuentes = [
  ['plex-sans/fonts/complete/woff2/IBMPlexSans-Regular.woff2', 'IBMPlexSans-Regular.woff2'],
  ['plex-sans/fonts/complete/woff2/IBMPlexSans-Medium.woff2', 'IBMPlexSans-Medium.woff2'],
  ['plex-sans/fonts/complete/woff2/IBMPlexSans-SemiBold.woff2', 'IBMPlexSans-SemiBold.woff2'],
  ['plex-mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2', 'IBMPlexMono-Regular.woff2'],
  ['plex-mono/fonts/complete/woff2/IBMPlexMono-Medium.woff2', 'IBMPlexMono-Medium.woff2'],
];

for (const [entrada, salida] of fuentes) {
  const original = readFileSync(join(origen, entrada));
  const subset = await subsetFont(original, texto, { targetFormat: 'woff2' });
  writeFileSync(join(destino, salida), subset);
  console.log(`${salida}: ${original.length} -> ${subset.length} bytes`);
}
