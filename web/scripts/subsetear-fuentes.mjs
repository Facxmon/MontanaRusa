// Genera public/fuentes/*.woff2: Lato (400, 500, 600), la fuente de la
// interfaz y de los numeros, e IBM Plex Mono (400, 500), que queda solo para
// lo que es codigo (claves del JSON, atajos, mensajes del nucleo), todas
// subseteadas a latin mas los simbolos que usa la interfaz. Sin CDN: las
// fuentes se sirven desde el sitio.
//
// Lato 2.0 sale del paquete npm lato-font@3.0.0 (devDependency; fuentes
// OFL-1.1, el CSS del paquete MIT, que no se usa), archivos
// fonts/lato-{normal,medium,semibold}/*.woff2. Se usa este paquete y no
// @fontsource/lato porque el de Fontsource es la version de Google Fonts, que
// no tiene los pesos 500 y 600 que usa la interfaz.
//
// Las cifras de Lato son TABULARES POR DEFECTO (todas de 1160 unidades de
// ancho, con o sin la feature tnum): `font-variant-numeric: tabular-nums` se
// sigue declarando en el CSS y no cambia nada. El script lo verifica sobre
// cada subset con harfbuzz y falla si deja de ser cierto.
//
// IBM Plex Mono (paquete @ibm/plex-mono@1.1.0, OFL-1.1) no se agrega como
// dependencia porque trae un postinstall de telemetria: si hace falta
// regenerarla, se instala aparte y se pasa la ruta.
//
//   node scripts/subsetear-fuentes.mjs                      (solo Lato)
//   npm install --prefix /tmp/plex @ibm/plex-mono@1.1.0
//   node scripts/subsetear-fuentes.mjs /tmp/plex/node_modules/@ibm   (Lato y Plex Mono)
//
// Lato no tiene ✕ ▶ ❚ ✗ ✓ ⟲ ⤢ ⚠ (dingbats y flechas): caen al fallback del
// sistema, igual que con Plex.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const plex = process.argv[2] ?? null;
const lato = join(fileURLToPath(new URL('../node_modules/lato-font/', import.meta.url)), 'fonts');
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
  [join(lato, 'lato-normal/lato-normal.woff2'), 'Lato-Regular.woff2', true],
  [join(lato, 'lato-medium/lato-medium.woff2'), 'Lato-Medium.woff2', true],
  [join(lato, 'lato-semibold/lato-semibold.woff2'), 'Lato-SemiBold.woff2', true],
  ...(plex
    ? [
        [join(plex, 'plex-mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2'), 'IBMPlexMono-Regular.woff2', false],
        [join(plex, 'plex-mono/fonts/complete/woff2/IBMPlexMono-Medium.woff2'), 'IBMPlexMono-Medium.woff2', false],
      ]
    : []),
];

/** Ancho (en unidades de la fuente) de cada cifra 0-9, con o sin la feature tnum. */
async function anchosDeCifras(sfnt, features) {
  const hb = await require('harfbuzzjs');
  const blob = hb.createBlob(sfnt);
  const cara = hb.createFace(blob, 0);
  const fuente = hb.createFont(cara);
  const anchos = [];
  for (const cifra of '0123456789') {
    const buffer = hb.createBuffer();
    buffer.addText(cifra);
    buffer.guessSegmentProperties();
    hb.shape(fuente, buffer, features);
    anchos.push(buffer.json()[0].ax);
    buffer.destroy();
  }
  fuente.destroy();
  cara.destroy();
  blob.destroy();
  return anchos;
}

for (const [entrada, salida, verificarCifras] of fuentes) {
  const original = readFileSync(entrada);
  if (verificarCifras) {
    // Se verifica sobre el subset sin comprimir: harfbuzz no lee woff2.
    const sfnt = await subsetFont(original, texto, { targetFormat: 'sfnt' });
    for (const features of ['', 'tnum']) {
      const anchos = await anchosDeCifras(sfnt, features);
      if (new Set(anchos).size !== 1) throw new Error(`${salida}: las cifras no son tabulares (${features || 'por defecto'}): ${anchos.join(', ')}`);
    }
  }
  const subset = await subsetFont(original, texto, { targetFormat: 'woff2' });
  writeFileSync(join(destino, salida), subset);
  console.log(`${salida}: ${original.length} -> ${subset.length} bytes${verificarCifras ? ' (cifras tabulares verificadas)' : ''}`);
}
