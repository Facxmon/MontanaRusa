// Genera src/contrato/tipos.ts a partir de ../esquema/layout-v1.schema.json.
// Los tipos del contrato no se escriben a mano: si cambia el esquema, se
// corre `npm run tipos` y se commitea el resultado.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const RUTA_ESQUEMA = fileURLToPath(new URL('../../esquema/layout-v1.schema.json', import.meta.url));
const RUTA_SALIDA = fileURLToPath(new URL('../src/contrato/tipos.ts', import.meta.url));

const esquema = JSON.parse(readFileSync(RUTA_ESQUEMA, 'utf8'));
// El titulo del esquema es una frase y el $id una URL; el tipo raiz se llama Layout.
delete esquema.title;
delete esquema.$id;

// Un $ref con una description al lado lo trata como un tipo nuevo (ArrayDeNumeros1,
// ArrayDeNumeros2, ...). La description ya esta en el esquema y en el contrato;
// aca se quita para que cada propiedad use el tipo compartido.
function limpiarRefs(nodo) {
  if (Array.isArray(nodo)) return nodo.forEach(limpiarRefs);
  if (nodo === null || typeof nodo !== "object") return;
  if ("$ref" in nodo) {
    for (const clave of Object.keys(nodo)) if (clave !== "$ref") delete nodo[clave];
    return;
  }
  Object.values(nodo).forEach(limpiarRefs);
}
limpiarRefs(esquema);

const banner = [
  '/* eslint-disable */',
  '// GENERADO por scripts/generar-tipos.mjs desde esquema/layout-v1.schema.json.',
  '// No editar a mano: correr `npm run tipos`.',
  '',
].join('\n');

const tipos = await compile(esquema, 'Layout', {
  bannerComment: banner,
  additionalProperties: false,
  style: { singleQuote: true, semi: true, printWidth: 110 },
});

writeFileSync(RUTA_SALIDA, tipos);
console.log(`tipos escritos en ${RUTA_SALIDA}`);
