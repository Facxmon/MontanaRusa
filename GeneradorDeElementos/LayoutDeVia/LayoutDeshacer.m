function Layout = LayoutDeshacer(Layout)
%LAYOUTDESHACER Quita el ultimo elemento y reconstruye la polilinea.

    if isempty(Layout.Elementos)
        warning('LayoutDeshacer:LayoutVacio', 'No hay elementos que deshacer.');
        return
    end

    Elementos = Layout.Elementos(1:end-1);
    Layout = LayoutNuevo(Layout.EstadoInicial, Layout.Parametros);
    for i = 1:numel(Elementos)
        Layout = LayoutAgregarElemento(Layout, Elementos{i}.Elemento, ...
                                       Elementos{i}.EstadoSalida, Elementos{i}.Reporte);
    end
end
