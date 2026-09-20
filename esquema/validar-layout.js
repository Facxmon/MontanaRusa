#!/usr/bin/env node
// Validador del contrato del visualizador (v1).
//
// Corre cada JSON contra esquema/layout-v1.schema.json (JSON Schema 2020-12,
// via ajv) y despues aplica los chequeos de consistencia que el esquema no
// puede expresar: largos de los arrays columnares, indices de sub-tramos en
// rango, continuidad entre elementos, coherencia entre el esquema de
// parametros y los valores, veredictos agregados. Termina con codigo 1 y un
// mensaje claro si algo falla.
//
// Uso:
//   node esquema/validar-layout.js golden/loop-clotoide.json
//   node esquema/validar-layout.js golden            (todos los .json de la carpeta)
//   node esquema/validar-layout.js golden layout_circuito.json
//
// Dependencias: npm install (dentro de esquema/).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const CARPETA_ESQUEMA = dirname(fileURLToPath(import.meta.url));
const RUTA_ESQUEMA = join(CARPETA_ESQUEMA, "layout-v1.schema.json");
const MAJOR_SOPORTADO = 1;
const ERRORES_POR_ARCHIVO = 25;
const TOLERANCIA_EMPALME = 1e-5; // m; el export redondea a 6 cifras significativas

// ---------------------------------------------------------------- esquema
function compilarEsquema() {
  const esquema = JSON.parse(readFileSync(RUTA_ESQUEMA, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  return ajv.compile(esquema);
}

function describirErrorDeEsquema(error) {
  const donde = error.instancePath === "" ? "(raiz)" : error.instancePath;
  let detalle = error.message ?? "";
  if (error.keyword === "additionalProperties") {
    detalle += `: '${error.params.additionalProperty}'`;
  } else if (error.keyword === "enum") {
    detalle += ` [${error.params.allowedValues.join(", ")}]`;
  } else if (error.keyword === "required") {
    detalle = `falta la propiedad requerida '${error.params.missingProperty}'`;
  }
  return `${donde}: ${detalle}`;
}

// ------------------------------------------------- consistencia semantica
function chequeosDeConsistencia(doc) {
  const errores = [];
  const falla = (mensaje) => errores.push(mensaje);

  // meta
  const major = Number(String(doc.meta.versionContrato).split(".")[0]);
  if (major !== MAJOR_SOPORTADO) {
    falla(`meta.versionContrato ${doc.meta.versionContrato}: este validador conoce el MAJOR ${MAJOR_SOPORTADO}`);
  }

  // parametros: el esquema autodescriptivo tiene que apuntar a claves que existen
  const { valores, esquema, defaults } = doc.parametros;
  const clavesDeclaradas = new Set();
  const revisarDeclaracion = (lista, origen) => {
    for (const declaracion of lista) {
      clavesDeclaradas.add(declaracion.clave);
      if (!(declaracion.clave in valores)) {
        falla(`parametros.esquema.${origen} declara '${declaracion.clave}' pero parametros.valores no lo tiene`);
      }
      if (!(declaracion.clave in defaults)) {
        falla(`parametros.esquema.${origen} declara '${declaracion.clave}' pero parametros.defaults no lo tiene`);
      }
    }
  };
  revisarDeclaracion(esquema.modo.parametros, "modo");
  for (const [tipo, lista] of Object.entries(esquema.elementos)) {
    revisarDeclaracion(lista, `elementos.${tipo}`);
  }
  revisarDeclaracion(esquema.aceptacion, "aceptacion");
  revisarDeclaracion(esquema.generales, "generales");

  if (esquema.modo.nombre !== valores.modoCurvatura) {
    falla(`parametros.esquema.modo.nombre '${esquema.modo.nombre}' no coincide con parametros.valores.modoCurvatura '${valores.modoCurvatura}'`);
  }
  if (!esquema.modo.opciones.includes(esquema.modo.nombre)) {
    falla(`parametros.esquema.modo.nombre '${esquema.modo.nombre}' no esta entre las opciones`);
  }
  for (const clave of Object.keys(valores)) {
    if (!(clave in defaults)) {
      falla(`parametros.valores.${clave} no existe en parametros.defaults: el boton de resetear no lo podria restaurar`);
    }
  }

  // elementos
  const { elementos } = doc;
  let todosLosElementosPasan = true;
  let posicionEsperada = doc.estadoInicial.posicion;
  let origenPosicion = "estadoInicial.posicion";

  elementos.forEach((elemento, i) => {
    const ruta = `elementos[${i}]`;
    if (elemento.indice !== i) {
      falla(`${ruta}.indice vale ${elemento.indice}; tiene que ser ${i}`);
    }

    // parametrosUsados = exactamente lo que declara el constructor del tipo
    const declaracionDelTipo = esquema.elementos[elemento.tipo];
    if (!declaracionDelTipo) {
      falla(`${ruta}.tipo '${elemento.tipo}' no tiene entrada en parametros.esquema.elementos`);
    } else {
      const declaradas = new Set(declaracionDelTipo.map((d) => d.clave));
      const usadas = new Set(Object.keys(elemento.parametrosUsados));
      for (const clave of declaradas) {
        if (!usadas.has(clave)) falla(`${ruta}.parametrosUsados no trae '${clave}', que el tipo ${elemento.tipo} declara`);
      }
      for (const clave of usadas) {
        if (!declaradas.has(clave)) falla(`${ruta}.parametrosUsados trae '${clave}', que el tipo ${elemento.tipo} no declara`);
      }
    }

    // ajustes (opcional, 1.1.0): claves de defaults, sin repetir en parametrosUsados algo distinto; inertes dentro de ajustes
    if (elemento.ajustes !== undefined) {
      for (const clave of Object.keys(elemento.ajustes)) {
        if (!(clave in defaults)) falla(`${ruta}.ajustes.${clave} no existe en parametros.defaults`);
      }
      if (elemento.inertes !== undefined) {
        for (const clave of elemento.inertes) {
          if (!(clave in elemento.ajustes)) falla(`${ruta}.inertes trae '${clave}' pero no esta en ${ruta}.ajustes`);
        }
      }
    } else if (elemento.inertes !== undefined && elemento.inertes.length > 0) {
      falla(`${ruta}.inertes sin ${ruta}.ajustes: un parametro inerte es siempre uno ajustado`);
    }

    // nodos: todos los arrays del largo prometido
    const { nodos } = elemento;
    const n = nodos.numeroDeNodos;
    for (const [clave, valor] of Object.entries(nodos)) {
      if (Array.isArray(valor) && valor.length !== n) {
        falla(`${ruta}.nodos.${clave} tiene ${valor.length} elementos y numeroDeNodos es ${n}`);
      }
    }
    if (nodos.puntoDeParada !== null && nodos.puntoDeParada !== undefined) {
      if (nodos.puntoDeParada >= n) {
        falla(`${ruta}.nodos.puntoDeParada ${nodos.puntoDeParada} esta fuera de [0, ${n - 1}]`);
      }
    }
    for (const clave of ["x", "y", "z", "xRiel", "yRiel", "zRiel", "arco"]) {
      if (nodos[clave].some((v) => v === null)) {
        falla(`${ruta}.nodos.${clave} tiene null: la geometria tiene que estar completa en todo nodo`);
      }
    }
    for (let k = 1; k < n; k++) {
      if (nodos.arco[k] < nodos.arco[k - 1]) {
        falla(`${ruta}.nodos.arco decrece entre los nodos ${k - 1} y ${k}`);
        break;
      }
    }

    // sub-tramos en rango (un sub-tramo vacio tiene indiceFin = indiceInicio - 1)
    elemento.subtramos.forEach((tramo, k) => {
      if (tramo.indiceInicio > n - 1 || tramo.indiceFin > n - 1) {
        falla(`${ruta}.subtramos[${k}] (${tramo.nombre}) sale del rango [0, ${n - 1}]: ${tramo.indiceInicio}..${tramo.indiceFin}`);
      }
      if (tramo.indiceFin < tramo.indiceInicio - 1) {
        falla(`${ruta}.subtramos[${k}] (${tramo.nombre}) tiene indiceFin ${tramo.indiceFin} < indiceInicio ${tramo.indiceInicio} - 1`);
      }
    });

    // empalme: el primer nodo del riel coincide con la posicion que dejo el anterior
    const primero = [nodos.xRiel[0], nodos.yRiel[0], nodos.zRiel[0]];
    const salto = distancia(primero, posicionEsperada);
    if (salto > TOLERANCIA_EMPALME) {
      falla(`${ruta}: el primer nodo del riel [${primero}] esta a ${salto.toExponential(2)} m de ${origenPosicion} [${posicionEsperada}]`);
    }
    const ultimo = [nodos.xRiel[n - 1], nodos.yRiel[n - 1], nodos.zRiel[n - 1]];
    const saltoSalida = distancia(ultimo, elemento.estadoSalida.posicion);
    if (saltoSalida > TOLERANCIA_EMPALME) {
      falla(`${ruta}.estadoSalida.posicion [${elemento.estadoSalida.posicion}] esta a ${saltoSalida.toExponential(2)} m del ultimo nodo del riel [${ultimo}]`);
    }
    posicionEsperada = elemento.estadoSalida.posicion;
    origenPosicion = `${ruta}.estadoSalida.posicion`;

    // criterios: el veredicto agregado es el AND de los individuales
    const { criterios } = elemento;
    const pasanTodos = [...criterios.previos, ...criterios.posteriores].every((c) => c.pasa);
    if (criterios.todosPasan !== pasanTodos) {
      falla(`${ruta}.criterios.todosPasan vale ${criterios.todosPasan} pero el AND de previos y posteriores da ${pasanTodos}`);
    }
    for (const [grupo, lista] of Object.entries({ previos: criterios.previos, posteriores: criterios.posteriores })) {
      lista.forEach((c, k) => {
        if (c.sentido === "Informativo") {
          if (c.pasa !== true) falla(`${ruta}.criterios.${grupo}[${k}] (${c.nombre}) es Informativo y pasa=${c.pasa}`);
        } else if (c.margen !== null && c.pasa !== c.margen >= 0) {
          falla(`${ruta}.criterios.${grupo}[${k}] (${c.nombre}) tiene margen ${c.margen} y pasa=${c.pasa}`);
        }
      });
    }
    todosLosElementosPasan = todosLosElementosPasan && criterios.todosPasan;
  });

  // resumenLayout
  const { resumenLayout } = doc;
  if (resumenLayout.numeroDeElementos !== elementos.length) {
    falla(`resumenLayout.numeroDeElementos vale ${resumenLayout.numeroDeElementos} y hay ${elementos.length} elementos`);
  }
  if (resumenLayout.todosLosCriteriosPasan !== todosLosElementosPasan) {
    falla(`resumenLayout.todosLosCriteriosPasan vale ${resumenLayout.todosLosCriteriosPasan} pero el AND de los elementos da ${todosLosElementosPasan}`);
  }
  for (const [eje, [minimo, maximo]] of resumenLayout.boundingBox.entries()) {
    if (minimo > maximo) falla(`resumenLayout.boundingBox[${eje}] tiene min ${minimo} > max ${maximo}`);
  }
  const zRiel = elementos.flatMap((e) => e.nodos.zRiel);
  const zMax = Math.max(...zRiel);
  const zMin = Math.min(...zRiel);
  if (resumenLayout.alturaMaxima !== null && Math.abs(resumenLayout.alturaMaxima - zMax) > TOLERANCIA_EMPALME) {
    falla(`resumenLayout.alturaMaxima ${resumenLayout.alturaMaxima} no coincide con el z maximo del riel ${zMax}`);
  }
  if (resumenLayout.alturaMinima !== null && Math.abs(resumenLayout.alturaMinima - zMin) > TOLERANCIA_EMPALME) {
    falla(`resumenLayout.alturaMinima ${resumenLayout.alturaMinima} no coincide con el z minimo del riel ${zMin}`);
  }

  return errores;
}

function distancia(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// ---------------------------------------------------------------- archivos
function expandirRutas(argumentos) {
  const rutas = [];
  for (const argumento of argumentos) {
    const ruta = resolve(argumento);
    let info;
    try {
      info = statSync(ruta);
    } catch {
      console.error(`No existe: ${argumento}`);
      process.exitCode = 1;
      continue;
    }
    if (info.isDirectory()) {
      const archivos = readdirSync(ruta)
        .filter((nombre) => extname(nombre) === ".json")
        .sort()
        .map((nombre) => join(ruta, nombre));
      if (archivos.length === 0) {
        console.error(`La carpeta ${argumento} no tiene archivos .json`);
        process.exitCode = 1;
      }
      rutas.push(...archivos);
    } else {
      rutas.push(ruta);
    }
  }
  return rutas;
}

function validarArchivo(validar, ruta) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(ruta, "utf8"));
  } catch (error) {
    return [`no es JSON valido: ${error.message}`];
  }
  const errores = [];
  if (!validar(doc)) {
    const lista = validar.errors ?? [];
    errores.push(...lista.slice(0, ERRORES_POR_ARCHIVO).map(describirErrorDeEsquema));
    if (lista.length > ERRORES_POR_ARCHIVO) {
      errores.push(`... y ${lista.length - ERRORES_POR_ARCHIVO} errores de esquema mas`);
    }
    // Sin esquema valido los chequeos de consistencia tirarian excepciones
    // sobre campos que faltan; se reportan solo los del esquema.
    return errores;
  }
  return chequeosDeConsistencia(doc);
}

function main() {
  const argumentos = process.argv.slice(2);
  if (argumentos.length === 0) {
    console.error("Uso: node esquema/validar-layout.js <archivo.json | carpeta> [...]");
    process.exit(2);
  }
  const validar = compilarEsquema();
  const rutas = expandirRutas(argumentos);
  let fallidos = 0;

  for (const ruta of rutas) {
    const errores = validarArchivo(validar, ruta);
    const doc = errores.length === 0 ? JSON.parse(readFileSync(ruta, "utf8")) : null;
    if (errores.length === 0) {
      const nodos = doc.elementos.reduce((suma, e) => suma + e.nodos.numeroDeNodos, 0);
      console.log(`[OK]    ${ruta}  (${doc.elementos.length} elementos, ${nodos} nodos, ${statSync(ruta).size} bytes)`);
    } else {
      fallidos += 1;
      console.log(`[FALLA] ${ruta}`);
      for (const error of errores) console.log(`        - ${error}`);
    }
  }

  console.log(`\n${rutas.length - fallidos} de ${rutas.length} archivos validan contra ${RUTA_ESQUEMA}.`);
  if (fallidos > 0 || process.exitCode === 1) {
    process.exit(1);
  }
}

main();
