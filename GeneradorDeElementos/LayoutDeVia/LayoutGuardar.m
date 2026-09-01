function LayoutGuardar(Layout, Archivo)
%LAYOUTGUARDAR Guarda el layout completo en un .mat.

    save(Archivo, 'Layout', '-v7.3');
    fprintf('Layout guardado en %s (%d elementos, %.4f m de via).\n', ...
            Archivo, numel(Layout.Elementos), sum(vecnorm(diff(Layout.PuntosRiel,1,1), 2, 2)));
end
