function Limite = LimitePorPunto(G, Tiempo, Curva, FactorTiempo, Signo)
%LIMITEPORPUNTO Limite normativo aplicable en cada punto del recorrido.
%   Para cada nodo se toma su propio nivel de G, se mide la duracion del
%   evento sostenido que lo contiene a ese nivel, se convierte a duracion
%   equivalente del prototipo y se evalua la curva limite ahi. Es la
%   aplicacion literal del criterio de la norma, punto por punto, y sirve
%   para superponer la banda de limite sobre el grafico de G.
%
%   Los eventos de menos de 200 ms no estan cubiertos (7.1.4.2); ahi se
%   evalua la curva en 0.2 s, que es su extremo mas permisivo.

    H = Signo * G(:);
    Tiempo = Tiempo(:);
    NumeroDeNodos = numel(H);
    Limite = nan(NumeroDeNodos, 1);

    for i = 1:NumeroDeNodos
        if ~isfinite(H(i)) || H(i) <= 0
            continue
        end

        Inicio = i;
        while Inicio > 1 && H(Inicio-1) >= H(i)
            Inicio = Inicio - 1;
        end
        Fin = i;
        while Fin < NumeroDeNodos && H(Fin+1) >= H(i)
            Fin = Fin + 1;
        end

        Duracion = max((Tiempo(Fin) - Tiempo(Inicio)) * FactorTiempo, 0.2);
        Limite(i) = Signo * LimiteNormativo(Curva, Duracion);
    end
end
