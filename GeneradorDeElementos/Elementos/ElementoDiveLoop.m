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
%
%   EN ESE MODO EL DIVE LOOP SALE "TORCIDO", Y NO ES UN BUG. Con el carro
%   invertido a roll fijo, la unica forma de darle a la curvatura del riel
%   una componente lateral sostenida (el sub-peralte psi) es inclinar el
%   plano entero del giro: la media vuelta sigue siendo PLANA, pero su plano
%   queda inclinado psi respecto de la vertical (~10.7 grados con los
%   defaults). Dos consecuencias geometricas, las dos del Gy objetivo:
%     - la salida queda desplazada lateralmente (~0.18 m con los defaults),
%     - el carro sale peraltado 2*psi (~21 grados), porque U gira pi
%       alrededor de la normal del plano inclinado y no de la horizontal.
%   El lado cambia con SentidoDelGiro. En Clotoide y FuerzaGConstante, que
%   no persiguen Gy, el giro es plano y vertical y el carro sale derecho
%   (verificado en Diagnostico/DiagnosticoPlanitudDiveLoop.m: distancia al
%   mejor plano por SVD del orden de 1e-14 en los tres modos, inclinacion
%   0 en los dos primeros y psi en el normativo). El peralte de salida es un
%   dato para el elemento siguiente, que lo tiene que deshacer con su
%   transicion de roll.
%
%   Llamado sin argumentos devuelve la declaracion de los parametros
%   geometricos que consume (ver DeclaracionDeParametros).

    if nargin == 0
        EstadoSalida = DeclaracionDeParametros( ...
            'RadioDelDiveLoop',      'm', ['radio de la heartline en la cuspide: en Clotoide es el que se impone; en los modos ' ...
                                           'dependientes de v es solo la longitud caracteristica de Froude y el radio real es una salida'], ...
            'SeparacionDelDiveLoop', 'm', 'avance sobre el eje de la helice (0: gira solo pi y no se cruza consigo mismo)', ...
            'SentidoDelGiro',        '-', 'lado hacia el que se desalinea la curvatura para el Gy objetivo en modo GNormativaMaxima');
        return
    end
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
