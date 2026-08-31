function Criterios = AgregarCriterio(Criterios, Nombre, Sentido, Valor, Limite, Unidad, Detalle)
%AGREGARCRITERIO Suma una linea al reporte estructurado de factibilidad.
%   Sentido: 'MenorOIgual' | 'MayorOIgual' | 'Informativo'.
%   El margen siempre es positivo cuando el criterio pasa, de modo que un
%   margen negativo se lee directo como cuanto falta.

    if nargin < 7
        Detalle = '';
    end

    switch Sentido
        case 'MenorOIgual'
            Margen = Limite - Valor;
            Pasa   = Margen >= 0;
        case 'MayorOIgual'
            Margen = Valor - Limite;
            Pasa   = Margen >= 0;
        case 'Informativo'
            Margen = NaN;
            Pasa   = true;
        otherwise
            error('AgregarCriterio:SentidoDesconocido', 'Sentido no reconocido: %s', Sentido);
    end

    Criterios(end+1) = struct('Nombre', Nombre, 'Sentido', Sentido, 'Pasa', Pasa, ...
                              'Valor', Valor, 'Limite', Limite, 'Margen', Margen, ...
                              'Unidad', Unidad, 'Detalle', Detalle);
end
