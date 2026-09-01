function [Track, Diagnostico] = ResolverMetodoA(EstadoEntrada, Parametros, Receta)
%RESOLVERMETODOA Marcha acoplada hacia adelante, una sola pasada.
%   En cada paso ds se resuelve todo junto: con v_k conocida se calcula
%   kappa_k segun el modo, se propaga geometria y marco con RK4 y se
%   actualiza la energia para obtener v_{k+1}.
%
%   A favor: una sola pasada, sin criterio de convergencia que ajustar.
%   En contra: la geometria queda atada a la marcha, asi que no se puede
%   imponer un perfil de velocidad de diseno distinto del que sale.

    Cronometro = tic;
    [Track, Diagnostico] = GenerarGeometria(EstadoEntrada, Parametros, Receta, []);

    Diagnostico.Metodo              = 'A - marcha acoplada';
    Diagnostico.IteracionesPuntoFijo = 1;
    Diagnostico.ResiduoPuntoFijo     = 0;
    Diagnostico.TiempoDeComputo      = toc(Cronometro);
end
