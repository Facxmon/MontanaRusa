function [EstadoSalida, Elemento, Reporte] = ElementoLoopVertical(EstadoEntrada, Parametros, Layout)
%ELEMENTOLOOPVERTICAL Loop vertical: vuelta completa en el plano vertical.
%   Gira 2*pi con la curvatura dentro del plano vertical, asi que el eje
%   "arriba" del carro apunta siempre al centro del loop y el pasajero queda
%   invertido en la cuspide.
%
%   La separacion entre patas es obligatoria: un giro de 2*pi contenido en un
%   plano vuelve a pasar por donde entro. Ver GenerarGeometria para el detalle
%   de como se consigue.

    if nargin < 3
        Layout = [];
    end

    Parametros.RadioDeReferencia = Parametros.RadioDelLoop;

    Receta.Nombre                 = 'LoopVertical';
    Receta.GiroObjetivo           = 2*pi;
    Receta.DesfasajeDeCurvatura   = 0;              % curvatura en el plano vertical
    Receta.RollDelElemento        = Parametros.RollExtraDelLoop;
    Receta.DesplazamientoObjetivo = Parametros.SeparacionDePatas;
    Receta.CurvaLimiteGz          = 'MasGzTodas';   % Fig. 10: lo que persigue el modo normativo

    [EstadoSalida, Elemento, Reporte] = ConstruirElemento(EstadoEntrada, Parametros, Receta, Layout);
end
