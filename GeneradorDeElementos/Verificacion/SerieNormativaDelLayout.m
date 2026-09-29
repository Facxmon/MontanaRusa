function Serie = SerieNormativaDelLayout(Sims, FactoresTiempo)
%SERIENORMATIVADELLAYOUT Linea de tiempo continua del layout para la norma.
%   Los eventos sostenidos de ASTM F2291 se miden de corrido en todo el
%   circuito: un evento que cruza uno o mas empalmes es un unico evento. Esta
%   funcion concatena las G de todos los elementos en una sola serie, con el
%   tiempo en PROTOTIPO: cada tramo se escala con el factorTiempo (sqrt de
%   lambda) de SU elemento y se acumula. Es lo mismo que arma el visualizador
%   para el eje "tiempo del prototipo" (series.ts, extraerColumnas).
%
%   En cada empalme el ultimo nodo de un elemento es el primero del
%   siguiente: se cuenta una sola vez (se descarta el primero del siguiente),
%   asi no hay un intervalo de duracion cero que corte el evento. Ese nodo
%   compartido pertenece a los dos elementos: Serie.Rango(i,:) son los
%   indices [primero, ultimo] de la serie que cubren el elemento i,
%   incluido el nodo del empalme de entrada.
%
%   Sims es un cell con el Sim de cada elemento y FactoresTiempo sus sqrt de
%   lambda. Con un solo elemento la serie es la del elemento, en su tiempo
%   del prototipo, y el resultado de la verificacion es el de siempre.
%
%   Duda abierta que esto NO resuelve: cada elemento tiene su lambda (su radio
%   caracteristico equivale al mismo radio del prototipo), asi que un evento
%   que cruza elementos suma duraciones con escalas de tiempo distintas.

    NumeroDeElementos = numel(Sims);
    Serie.TiempoPrototipo = zeros(0, 1);
    Serie.Gx = zeros(0, 1);
    Serie.Gy = zeros(0, 1);
    Serie.Gz = zeros(0, 1);
    Serie.Rango = zeros(NumeroDeElementos, 2);

    Desfase = 0;
    for i = 1:NumeroDeElementos
        Sim = Sims{i};
        Tiempo = Sim.Tiempo(:) * FactoresTiempo(i) + Desfase;
        if i == 1
            Desde = 1;
            Serie.Rango(i, 1) = 1;
        else
            Desde = 2;
            Serie.Rango(i, 1) = numel(Serie.TiempoPrototipo);   % el nodo del empalme
        end
        Serie.TiempoPrototipo = [Serie.TiempoPrototipo; Tiempo(Desde:end)];
        Serie.Gx = [Serie.Gx; Sim.Gx(Desde:end)];
        Serie.Gy = [Serie.Gy; Sim.Gy(Desde:end)];
        Serie.Gz = [Serie.Gz; Sim.Gz(Desde:end)];
        Serie.Rango(i, 2) = numel(Serie.TiempoPrototipo);

        % El proximo elemento arranca donde termina este. Si el carro se
        % quedo sin energia el tiempo del final es NaN; el desfase se toma
        % del ultimo nodo con tiempo, y los nodos sin G cortan los eventos.
        UltimoConTiempo = find(~isnan(Sim.Tiempo), 1, 'last');
        Desfase = Desfase + Sim.Tiempo(UltimoConTiempo) * FactoresTiempo(i);
    end

    [Serie.Reducida, Serie.EnAirtimeLargo] = VentanasMasGzReducido(Serie.Gz, Serie.TiempoPrototipo);
end
