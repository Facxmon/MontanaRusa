function [Limites, Duraciones, Curvas, Segmentos] = LimitesDelEvento(Tiempo, Inicio, Fin, Curva, Reducida)
%LIMITESDELEVENTO Limites que tiene que cumplir un evento sostenido [Inicio, Fin].
%   Tiempo es el del PROTOTIPO. Sin ventanas de 7.1.7.1 es un solo limite:
%   la curva evaluada en la duracion del evento (llevada a 0.2 s si es
%   menor, criterio conservador del proyecto).
%
%   7.1.7.1 (decision del usuario): despues de mas de 3 s de -Gz, la curva
%   +Gz reducida es un "debuff" que rige durante 6 s; pasados esos 6 s
%   vuelven los limites normales, PERO el evento no se resetea: la duracion
%   se sigue contando desde que el evento empezo. Asi, un evento que empieza
%   dentro de la ventana y termina afuera tiene que cumplir las dos cosas:
%     - dentro de la ventana, MasGzReducido en la duracion acumulada hasta el
%       final de la ventana (o del evento, si termina antes);
%     - despues, la curva normal en la duracion acumulada hasta el final del
%       evento, contando tambien el tiempo que paso dentro de la ventana.
%   Como las curvas bajan con la duracion, alcanza con evaluar cada tramo de
%   un mismo regimen en su ultimo nodo. Segmentos(k,:) = [primero, ultimo]
%   nodo de cada tramo, y Limites(k) (modulo), Duraciones(k) y Curvas{k} son
%   los de ese tramo. Reducida vacia = sin ventanas.

    if isempty(Reducida)
        EnVentana = false(Fin - Inicio + 1, 1);
    else
        EnVentana = logical(Reducida(Inicio:Fin));
        EnVentana = EnVentana(:);
    end
    Cambios = find(diff(EnVentana) ~= 0);
    Primeros = [Inicio; Inicio + Cambios];
    Ultimos  = [Inicio + Cambios - 1; Fin];
    Segmentos = [Primeros, Ultimos];

    NumeroDeTramos = numel(Primeros);
    Limites = zeros(NumeroDeTramos, 1);
    Duraciones = zeros(NumeroDeTramos, 1);
    Curvas = cell(NumeroDeTramos, 1);
    for k = 1:NumeroDeTramos
        if EnVentana(Primeros(k) - Inicio + 1)
            Curvas{k} = 'MasGzReducido';
        else
            Curvas{k} = Curva;
        end
        Duraciones(k) = max(Tiempo(Ultimos(k)) - Tiempo(Inicio), 0.2);
        Limites(k) = abs(LimiteNormativo(Curvas{k}, Duraciones(k)));
    end
end
