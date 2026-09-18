// Provisorio: la Tarea 8 arma el flujo completo.
const indice = `${import.meta.env.BASE_URL}golden/indice.json`;
fetch(indice)
  .then((respuesta) => respuesta.json())
  .then((datos: { casos: string[] }) => {
    const seccion = document.getElementById('selectorDeCaso');
    if (seccion) seccion.textContent = `Casos disponibles: ${datos.casos.join(', ')}`;
  });
