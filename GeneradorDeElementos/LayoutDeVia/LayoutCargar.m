function Layout = LayoutCargar(Archivo)
%LAYOUTCARGAR Recupera un layout guardado con LayoutGuardar.

    Datos = load(Archivo, 'Layout');
    Layout = Datos.Layout;
end
