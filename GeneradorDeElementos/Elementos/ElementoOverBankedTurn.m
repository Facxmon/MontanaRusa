function [EstadoSalida, Elemento, Reporte] = ElementoOverBankedTurn(EstadoEntrada, Parametros, Layout)
%ELEMENTOOVERBANKEDTURN Giro peraltado mas alla de la vertical.
%   Geometricamente es una helice de menos de una vuelta: la curvatura queda
%   horizontal y el elemento cambia el rumbo. Lo que lo hace over-banked es el
%   peralte, que pasa de 90 grados y deja al pasajero mirando hacia adentro y
%   un poco hacia abajo.
%
%   Que el peralte sea un parametro aparte de la curvatura es justamente lo que
%   permite pasarse de 90 grados: la curva sigue siendo horizontal y lo unico
%   que cambia es como esta parado el carro sobre ella. Eso lo habilita el
%   marco de transporte paralelo con el roll explicito encima; con Frenet el
%   peralte quedaria atado a la geometria y no se podria elegir.

    if nargin < 3
        Layout = [];
    end

    Parametros.RadioDeReferencia = Parametros.RadioDelGiro;
    Sentido = SignoDelSentido(Parametros.SentidoDelGiro);

    Receta.Nombre                 = 'OverBankedTurn';
    Receta.GiroObjetivo           = Parametros.AnguloDelGiro;
    Receta.DesfasajeDeCurvatura   = Sentido * pi/2;
    Receta.RollDelElemento        = Sentido * Parametros.PeralteDelGiro;
    Receta.DesplazamientoObjetivo = -Sentido * Parametros.AvanceDelGiro;

    [EstadoSalida, Elemento, Reporte] = ConstruirElemento(EstadoEntrada, Parametros, Receta, Layout);
end

function Signo = SignoDelSentido(Texto)
    if strcmpi(Texto, 'Izquierda')
        Signo = -1;
    elseif strcmpi(Texto, 'Derecha')
        Signo = +1;
    else
        error('ElementoOverBankedTurn:SentidoDesconocido', ...
              'SentidoDelGiro tiene que ser ''Derecha'' o ''Izquierda'', no ''%s''.', Texto);
    end
end
