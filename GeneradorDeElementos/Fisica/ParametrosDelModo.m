function [Lista, Nota] = ParametrosDelModo(Modo)
%PARAMETROSDELMODO Que parametros de entrada consume cada modo de curvatura.
%   Fuente unica de verdad, consultable desde el codigo: DemoElemento la usa
%   para mostrar solo lo que aplica al modo elegido y AjustarParametros para
%   avisar si se carga un parametro que ese modo no lee. Tiene que coincidir
%   con lo que CurvaturaDelModo efectivamente lee; si se agrega un modo o un
%   parametro, se cambia en los dos lugares.
%
%   Sin argumentos devuelve la lista de modos.
%
%   Cada fila: Nombre (campo de Parametros), Unidad, Descripcion. Nota es un
%   texto para el caso en que el modo no consume ningun parametro global.
%
%   Lo que NO esta aca a proposito: RadioDeReferencia es la longitud
%   caracteristica de Froude en todos los modos (fija lambda, el presupuesto
%   de onset y la conversion de duraciones) y lo pisa cada elemento con su
%   radio, asi que es un parametro geometrico del elemento; solo en Clotoide
%   es ademas el radio que la curvatura efectivamente toma. GMinimaCuspide
%   tampoco: es un criterio de aceptacion valido en todos los modos.

    Modos = {'AceleracionNormalConstante', 'Clotoide', 'FuerzaGConstante', 'GNormativaMaxima'};
    if nargin == 0
        Lista = Modos;
        Nota = '';
        return
    end

    Nota = '';
    switch Modo
        case 'AceleracionNormalConstante'
            Lista = Fila('AceleracionNormalObjetivo', 'm/s^2', ...
                         'aceleracion centripeta del pasajero sobre U, sin la gravedad, constante en el arco');
        case 'Clotoide'
            Lista = Fila('RadioDeReferencia', 'm', ...
                         'radio de la heartline en el arco (el riel va d*cos(psi) mas afuera); lo pisa cada elemento con su radio');
        case 'FuerzaGConstante'
            Lista = Fila('FuerzaGObjetivo', 'G', ...
                         'Gz neta del pasajero, incluida la gravedad, constante en el arco');
        case 'GNormativaMaxima'
            Lista = Fila();
            Nota = ['ninguno global: la curva de la norma que persigue es parte de la Receta del elemento ' ...
                    '(Receta.CurvaLimiteGz en los cuatro; CurvaLimiteGy y SentidoDeGy en el dive loop)'];
        otherwise
            error('ParametrosDelModo:ModoDesconocido', ...
                  'Modo de curvatura no reconocido: %s. Los modos son: %s.', Modo, strjoin(Modos, ', '));
    end
end

function Lista = Fila(varargin)
%FILA Struct array con una fila por cada terna (Nombre, Unidad, Descripcion).
    Lista = struct('Nombre', {}, 'Unidad', {}, 'Descripcion', {});
    for i = 1:3:numel(varargin)
        Lista(end+1) = struct('Nombre', varargin{i}, 'Unidad', varargin{i+1}, 'Descripcion', varargin{i+2}); %#ok<AGROW>
    end
end
