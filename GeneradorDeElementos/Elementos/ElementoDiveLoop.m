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

    if nargin < 3
        Layout = [];
    end

    Parametros.RadioDeReferencia = Parametros.RadioDelDiveLoop;

    Receta.Nombre                 = 'DiveLoop';
    Receta.GiroObjetivo           = pi;
    Receta.DesfasajeDeCurvatura   = pi;    % curvatura hacia abajo: el carro se zambulle
    Receta.RollDelElemento        = pi;    % entra invertido
    Receta.DesplazamientoObjetivo = Parametros.SeparacionDelDiveLoop;
    Receta.CurvaLimiteGz          = 'MasGzTodas';   % Fig. 10: lo que persigue el modo normativo

    [EstadoSalida, Elemento, Reporte] = ConstruirElemento(EstadoEntrada, Parametros, Receta, Layout);
end
