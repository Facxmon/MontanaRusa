function DescribirParametros(Parametros, Elegido)
%DESCRIBIRPARAMETROS Imprime, con unidades, solo los parametros que aplican.
%   Tres grupos, visiblemente separados, y nada mas:
%     1. los parametros del modo de curvatura elegido (ParametrosDelModo);
%     2. los parametros geometricos del elemento elegido (el elemento sin
%        argumentos);
%     3. los criterios de aceptacion (ParametrosDeAceptacion), que valen en
%        todos los modos y para todos los elementos.
%   Lo que no aparece aca (fisica, carro, discretizacion, tolerancias
%   numericas) es global y esta en ParametrosPorDefecto.

    Modo = Parametros.ModoCurvatura;
    [DelModo, Nota] = ParametrosDelModo(Modo);

    fprintf('\n--- Parametros del modo de curvatura: %s ---\n', Modo);
    if isempty(DelModo)
        fprintf('  (%s)\n', Nota);
    else
        ImprimirLista(Parametros, DelModo);
    end

    fprintf('\n--- Parametros geometricos del elemento: %s ---\n', func2str(Elegido));
    ImprimirLista(Parametros, Elegido());

    fprintf('\n--- Criterios de aceptacion (todos los modos, todos los elementos) ---\n');
    ImprimirLista(Parametros, ParametrosDeAceptacion());
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
