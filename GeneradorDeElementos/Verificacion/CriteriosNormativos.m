function Criterios = CriteriosNormativos(Normativo)
%CRITERIOSNORMATIVOS Lineas del reporte que resumen el bloque normativo.
%   Limites dependientes de la duracion (Figs. 6-10), reversiones en X e Y
%   (7.1.6) y elipses de dos ejes (7.1.5.1), en ese orden. Salen solo de
%   Normativo (VerificarLimitesNormativos), asi que ChequeosPosteriores las
%   arma para el elemento suelto y VerificarLayoutNormativo las vuelve a
%   armar, con el mismo orden y los mismos nombres, cuando recalcula el
%   bloque sobre la linea de tiempo del layout.

    Criterios = CriteriosVacios();

    Criterios = AgregarCriterioNormativo(Criterios, '+Gz (Fig. 10)',   Normativo.MasGz);
    Criterios = AgregarCriterioNormativo(Criterios, '-Gz (Fig. 9)',    Normativo.MenosGz);
    Criterios = AgregarCriterioNormativo(Criterios, 'Gy (Fig. 8)',     Normativo.Gy);
    Criterios = AgregarCriterioNormativo(Criterios, '+Gx (Fig. 6)',    Normativo.MasGx);
    Criterios = AgregarCriterioNormativo(Criterios, '-Gx (Fig. 7)',    Normativo.MenosGx);

    Criterios = AgregarCriterioDeReversion(Criterios, 'Reversiones de Gx (7.1.6)', Normativo.ReversionGx);
    Criterios = AgregarCriterioDeReversion(Criterios, 'Reversiones de Gy (7.1.6)', Normativo.ReversionGy);

    Criterios = AgregarCriterio(Criterios, 'Elipse de dos ejes Gy-Gz (7.1.5.1)', 'MenorOIgual', ...
        Normativo.Elipse.ValorMaximoGyGz, 1, '-', ...
        'Semiejes iguales a los limites de 200 ms multiplicados por 1.1.');
    Criterios = AgregarCriterio(Criterios, 'Elipse de dos ejes Gx-Gz (7.1.5.1)', 'MenorOIgual', ...
        Normativo.Elipse.ValorMaximoGxGz, 1, '-');
    Criterios = AgregarCriterio(Criterios, 'Elipse de dos ejes Gx-Gy (7.1.5.1)', 'MenorOIgual', ...
        Normativo.Elipse.ValorMaximoGxGy, 1, '-');
end

function Criterios = AgregarCriterioNormativo(Criterios, Nombre, Evento)
    if ~isfinite(Evento.Exceso)
        Criterios = AgregarCriterio(Criterios, Nombre, 'Informativo', Evento.PicoG, NaN, 'G', ...
            sprintf('Sin G evaluable de ese signo (el maximo no llega a %.2f G): no hay evento que evaluar.', ...
                    GMinimaEvaluable()));
        return
    end
    Criterios = AgregarCriterio(Criterios, Nombre, 'MenorOIgual', Evento.Exceso, 0, 'G', ...
        sprintf(['Nivel critico %.2f G sostenido %.2f s equivalentes reales; limite %.2f G. ' ...
                 'Los eventos de menos de 0.2 s se evaluan contra el limite de 200 ms.'], ...
                Evento.NivelCritico, Evento.DuracionReal, Evento.LimiteAplicado));
end

function Criterios = AgregarCriterioDeReversion(Criterios, Nombre, Reversion)
    if Reversion.Reducida
        Criterios = AgregarCriterio(Criterios, Nombre, 'MenorOIgual', Reversion.Exceso, 0, 'G', ...
            sprintf(['Reversion entre eventos sostenidos con %.3f s entre picos (menos de 0.2 s): el limite ' ...
                     'del pico cae al 50 %%. Pico %.2f G sostenido %.2f s reales; limite reducido %.2f G.'], ...
                    Reversion.TiempoPicoAPico, Reversion.PicoG, Reversion.DuracionReal, Reversion.LimiteReducido));
        return
    end
    if isfinite(Reversion.TiempoPicoAPicoMinimo)
        Detalle = ['Ninguna reversion entre eventos sostenidos tiene menos de 0.2 s entre picos: sin ' ...
                   'reduccion del limite. El valor es la mas rapida, en s reales.'];
    else
        Detalle = 'Sin reversiones entre eventos sostenidos de signo opuesto.';
    end
    Criterios = AgregarCriterio(Criterios, Nombre, 'Informativo', Reversion.TiempoPicoAPicoMinimo, 0.2, 's', Detalle);
end
