function Criterios = CriteriosVacios()
%CRITERIOSVACIOS Arreglo de struct vacio con los campos del reporte.

    Criterios = struct('Nombre', {}, 'Sentido', {}, 'Pasa', {}, 'Valor', {}, ...
                       'Limite', {}, 'Margen', {}, 'Unidad', {}, 'Detalle', {});
end
