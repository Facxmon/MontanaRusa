function DescribirParametros(Parametros, Elegido)
%DESCRIBIRPARAMETROS Imprime, con unidades, los parametros de la corrida.
%   Cuatro grupos, visiblemente separados, los mismos cuatro bloques de
%   ParametrosPorDefecto:
%     1. los parametros del modo de curvatura elegido (ParametrosDelModo);
%     2. los parametros geometricos del elemento elegido (el elemento sin
%        argumentos);
%     3. los criterios de aceptacion (ParametrosDeAceptacion), que valen en
%        todos los modos y para todos los elementos;
%     4. los generales (ParametrosGenerales): fisica, carro, resolucion,
%        escalado, discretizacion y tolerancias numericas.
%   Cada grupo sale de su propia declaracion, nunca de una lista escrita aca.

    Modo = Parametros.ModoCurvatura;
    [DelModo, Nota] = ParametrosDelModo(Modo);

    fprintf('\n--- Parametros del modo de curvatura: %s ---\n', Modo);
    if ~isempty(Nota)
        fprintf('  (%s)\n', Nota);
    end
    if isempty(DelModo)
        if isempty(Nota)
            fprintf('  (ninguno)\n');
        end
    else
        ImprimirLista(Parametros, DelModo);
    end

    fprintf('\n--- Parametros geometricos del elemento: %s ---\n', func2str(Elegido));
    ImprimirLista(Parametros, Elegido());

    fprintf('\n--- Criterios de aceptacion (todos los modos, todos los elementos) ---\n');
    ImprimirLista(Parametros, ParametrosDeAceptacion());

    fprintf('\n--- Parametros generales (fisica, carro, resolucion, escalado, discretizacion, tolerancias) ---\n');
    ImprimirLista(Parametros, ParametrosGenerales());
end

function ImprimirLista(Parametros, Lista)
    for i = 1:numel(Lista)
        fprintf('  %-28s = %-22s [%s]  %s\n', Lista(i).Nombre, ...
                TextoDelValor(Parametros.(Lista(i).Nombre)), Lista(i).Unidad, Lista(i).Descripcion);
    end
end

function Texto = TextoDelValor(Valor)
    if ischar(Valor) || isstring(Valor)
        Texto = sprintf('''%s''', Valor);
    elseif isempty(Valor)
        Texto = '[]';
    elseif isscalar(Valor)
        Texto = sprintf('%.4g', Valor);
    elseif ~isvector(Valor)
        Texto = mat2str(Valor, 3);
    else
        Texto = ['[', strjoin(arrayfun(@(x) sprintf('%.3g', x), Valor(:).', 'UniformOutput', false), ' '), ']'];
    end
end
