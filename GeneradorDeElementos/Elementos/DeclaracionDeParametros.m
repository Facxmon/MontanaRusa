function Lista = DeclaracionDeParametros(varargin)
%DECLARACIONDEPARAMETROS Arma la lista de parametros que consume un elemento.
%   Cada elemento la llama con ternas (Nombre, Unidad, Descripcion) y la
%   devuelve cuando se lo invoca sin argumentos:
%
%       Lista = ElementoLoopVertical()
%
%   Es la fuente unica de verdad de que parametros geometricos lee cada
%   elemento, en el mismo archivo que la Receta que los consume. La usan
%   DescribirParametros y AjustarParametros. Misma forma que la lista de
%   ParametrosDelModo, para poder concatenarlas.

    Lista = struct('Nombre', {}, 'Unidad', {}, 'Descripcion', {});
    for i = 1:3:numel(varargin)
        Lista(end+1) = struct('Nombre', varargin{i}, 'Unidad', varargin{i+1}, 'Descripcion', varargin{i+2}); %#ok<AGROW>
    end
end
