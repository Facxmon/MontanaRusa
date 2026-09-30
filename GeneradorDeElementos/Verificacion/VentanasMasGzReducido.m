function [Reducida, EnAirtimeLargo] = VentanasMasGzReducido(Gz, TiempoPrototipo)
%VENTANASMASGZREDUCIDO Nodos donde rige la curva +Gz reducida (7.1.7.1).
%   "Si hubo -Gz sostenido por mas de 3 s, los limites de +Gz caen a la
%   columna reducida durante los 6 s siguientes." Se aplica en forma literal
%   sobre la linea de tiempo continua del layout (SerieNormativaDelLayout),
%   en tiempo del PROTOTIPO:
%     - un evento -Gz es un intervalo continuo con -Gz >= GMinimaEvaluable;
%     - si dura mas de 3 s, la transicion a +Gz es el primer nodo posterior
%       con Gz >= GMinimaEvaluable, y la ventana son los nodos que caen a 6 s
%       o menos de esa transicion. Despues vuelve MasGzTodas.
%
%   Un evento de +Gz que empieza dentro de la ventana y termina fuera se
%   evalua con la curva reducida mientras esta adentro y con la normal
%   despues, sin resetear su duracion (LimitesDelEvento, decision del
%   usuario). La norma no fija el instante exacto de la "transicion" (fin del
%   -Gz o comienzo del +Gz); con el umbral de 0.01 G la diferencia es de
%   milisegundos.
%
%   Reducida es una mascara logica del largo de Gz. EnAirtimeLargo marca los
%   nodos de los eventos -Gz de mas de 3 s (Normativo.HuboAirtimeSostenido).

    Gz = Gz(:);
    TiempoPrototipo = TiempoPrototipo(:);
    NumeroDeNodos = numel(Gz);
    Reducida = false(NumeroDeNodos, 1);
    EnAirtimeLargo = false(NumeroDeNodos, 1);
    Umbral = GMinimaEvaluable();

    Eventos = TramosContiguos(-Gz >= Umbral);
    for k = 1:size(Eventos, 1)
        Inicio = Eventos(k,1);
        Fin = Eventos(k,2);
        if TiempoPrototipo(Fin) - TiempoPrototipo(Inicio) <= 3.0
            continue
        end
        EnAirtimeLargo(Inicio:Fin) = true;
        Transicion = Fin + find(Gz(Fin+1:end) >= Umbral, 1);
        if isempty(Transicion)
            continue
        end
        Reducida = Reducida | ((1:NumeroDeNodos).' >= Transicion ...
                               & TiempoPrototipo - TiempoPrototipo(Transicion) <= 6.0);
    end
end

function Tramos = TramosContiguos(Mascara)
%TRAMOSCONTIGUOS Indices de inicio y fin de cada corrida de true.
    Mascara = Mascara(:).';
    Bordes = diff([false, Mascara, false]);
    Inicios = find(Bordes == 1);
    Finales = find(Bordes == -1) - 1;
    Tramos = [Inicios(:), Finales(:)];
end
