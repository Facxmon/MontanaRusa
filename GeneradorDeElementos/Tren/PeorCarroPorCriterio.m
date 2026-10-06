function Posteriores = PeorCarroPorCriterio(Posteriores, PorCarro, Carros, Cantidad)
%PEORCARROPORCRITERIO Reemplaza cada linea dinamica por la del carro que peor anda.
%   PorCarro es un cell con las lineas de CriteriosDelCarro de cada carro
%   calculado. Para cada nombre, se toma la del carro que no pasa o, si
%   pasan todos, la de menor margen; las informativas, la de valor maximo
%   (G en la cabeza) o minimo (tiempo entre picos de una reversion). El
%   detalle dice de que carro es. Asi el veredicto del elemento es el de
%   TODOS los carros: pasa solo si pasa el peor. Carros son los numeros de
%   carro de PorCarro y Cantidad los carros del tren.
    for j = 1:numel(PorCarro{1})
        Nombre = PorCarro{1}(j).Nombre;
        Indice = find(strcmp({Posteriores.Nombre}, Nombre), 1);
        if isempty(Indice)
            continue
        end
        Lineas = cellfun(@(C) C(j), PorCarro);
        Peor = ElegirPeor(Lineas);
        Linea = Lineas(Peor);
        if numel(Carros) == 1
            Prefijo = sprintf('Carro %d de %d (solo se calcula ese). ', Carros(1), Cantidad);
        else
            Prefijo = sprintf('Peor carro: %d de %d. ', Carros(Peor), Cantidad);
        end
        Linea.Detalle = [Prefijo, Linea.Detalle];
        Posteriores(Indice) = Linea;
    end
end

function Peor = ElegirPeor(Lineas)
    if strcmp(Lineas(1).Sentido, 'Informativo')
        Valores = [Lineas.Valor];
        if all(isnan(Valores))
            Peor = 1;
        elseif contains(Lineas(1).Nombre, 'maxima')
            [~, Peor] = max(Valores);
        else
            [~, Peor] = min(Valores);
        end
        return
    end
    NoPasa = find(~[Lineas.Pasa]);
    Margenes = [Lineas.Margen];
    if ~isempty(NoPasa)
        % Entre las que fallan, la de margen mas negativo (NaN = no evaluable, la peor).
        M = Margenes(NoPasa);
        M(isnan(M)) = -Inf;
        [~, k] = min(M);
        Peor = NoPasa(k);
        return
    end
    Margenes(isnan(Margenes)) = Inf;
    [~, Peor] = min(Margenes);
end
