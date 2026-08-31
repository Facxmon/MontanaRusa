function Layout = LayoutAgregarElemento(Layout, Elemento, EstadoSalida, Reporte)
%LAYOUTAGREGARELEMENTO Encadena un elemento generado al final del layout.

    if nargin < 4
        Reporte = [];
    end

    Registro.Elemento     = Elemento;
    Registro.EstadoEntrada = Elemento.EstadoEntrada;
    Registro.EstadoSalida  = EstadoSalida;
    Registro.Reporte       = Reporte;

    Layout.Elementos{end+1} = Registro;
    Layout.EstadoActual     = EstadoSalida;

    % El primer nodo del elemento coincide con el ultimo del layout, asi que
    % se descarta para no duplicar puntos en la polilinea.
    if isempty(Layout.Puntos)
        Layout.Puntos       = Elemento.Track.Puntos;
        Layout.LongitudArco = Elemento.Track.LongitudArco;
    else
        Layout.Puntos       = [Layout.Puntos;       Elemento.Track.Puntos(2:end, :)];
        Layout.LongitudArco = [Layout.LongitudArco; Elemento.Track.LongitudArco(2:end)];
    end
end
