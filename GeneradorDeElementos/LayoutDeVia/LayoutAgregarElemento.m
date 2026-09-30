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
    if isempty(Layout.PuntosRiel)
        Layout.PuntosRiel       = Elemento.Track.PuntosRiel;
        Layout.LongitudArcoRiel = Elemento.Track.LongitudArco;
    else
        Layout.PuntosRiel       = [Layout.PuntosRiel;       Elemento.Track.PuntosRiel(2:end, :)];
        Layout.LongitudArcoRiel = [Layout.LongitudArcoRiel; Elemento.Track.LongitudArco(2:end)];
    end

    % Los eventos sostenidos de la norma se miden de corrido en todo el
    % circuito: el elemento nuevo puede alargar un evento del anterior, asi
    % que se vuelve a verificar el layout entero.
    Layout = VerificarLayoutNormativo(Layout);
end
