function [EstadoSalida, Elemento, Reporte] = ElementoDiveLoop(EstadoEntrada, Parametros, Layout)
%ELEMENTODIVELOOP Dive loop: medio tonel y media vuelta hacia abajo.
%   Es el inverso de un Immelmann. Entra a nivel arriba de una loma, rueda 180
%   grados hasta quedar invertido, y de ahi hace media vuelta hacia abajo:
%   sale a nivel, mas bajo y con el rumbo dado vuelta.
%
%   Con la maquinaria del motor son tres numeros:
%     - la curvatura apunta hacia abajo (desfasaje pi) en vez de hacia arriba,
%     - el roll del elemento es pi, o sea invertido,
%     - el giro objetivo es pi en vez de 2*pi.
%   El medio tonel lo hace solo el sub-tramo de acondicionamiento, con el
%   smoothstep quintico y la longitud que pide el presupuesto de onset lateral.
%   Al girar solo pi la via no llega a cruzarse consigo misma, asi que no
%   necesita separacion entre patas.
%
%   En modo GNormativaMaxima es el unico elemento que persigue dos G a la
%   vez: el +Gz de la Fig. 10 y un Gy lateral, que el modo consigue
%   desalineando la curvatura respecto de U (sub-peralte). El Gy objetivo no
%   es el maximo de la Fig. 8: los dos maximos juntos violan la elipse de
%   7.1.5.1, asi que se prioriza el Gz y el Gy es lo que deja la elipse
%   (CurvaturaDelModo). El lado lo fija SentidoDelGiro.

    if nargin < 3
        Layout = [];
    end

    Parametros.RadioDeReferencia = Parametros.RadioDelDiveLoop;
    Sentido = SignoDelSentido(Parametros.SentidoDelGiro);

    Receta.Nombre                 = 'DiveLoop';
    Receta.GiroObjetivo           = pi;
    Receta.DesfasajeDeCurvatura   = pi;    % curvatura hacia abajo: el carro se zambulle
    Receta.RollDelElemento        = pi;    % entra invertido
    Receta.DesplazamientoObjetivo = Parametros.SeparacionDelDiveLoop;
    Receta.CurvaLimiteGz          = 'MasGzTodas';   % Fig. 10: lo que persigue el modo normativo
    Receta.CurvaLimiteGy          = 'GyBase';       % Fig. 8, acotada por la elipse de 7.1.5.1
    Receta.SentidoDeGy            = Sentido;        % +1 hacia el versor lateral del carro

    [EstadoSalida, Elemento, Reporte] = ConstruirElemento(EstadoEntrada, Parametros, Receta, Layout);
end

function Signo = SignoDelSentido(Texto)
%SIGNODELSENTIDO +1 hacia el versor lateral del carro. Como el dive loop entra
%   invertido, "Derecha" es la derecha del pasajero cabeza abajo.
    if strcmpi(Texto, 'Izquierda')
        Signo = -1;
    elseif strcmpi(Texto, 'Derecha')
        Signo = +1;
    else
        error('ElementoDiveLoop:SentidoDesconocido', ...
              'SentidoDelGiro tiene que ser ''Derecha'' o ''Izquierda'', no ''%s''.', Texto);
    end
end
