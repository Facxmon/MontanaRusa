function Layout = LayoutNuevo(EstadoInicialDelLayout, Parametros)
%LAYOUTNUEVO Layout vacio, listo para encadenar elementos.
%   Guarda la polilinea acumulada de toda la via ya construida, que es lo que
%   necesita el chequeo de interferencia del elemento siguiente. Acumula el
%   RIEL y no el heartline: la interferencia es entre piezas fisicas.

    Layout.EstadoInicial    = EstadoInicialDelLayout;
    Layout.EstadoActual     = EstadoInicialDelLayout;
    Layout.Parametros       = Parametros;
    Layout.Elementos        = {};
    Layout.PuntosRiel       = zeros(0, 3);
    Layout.LongitudArcoRiel = zeros(0, 1);
end
