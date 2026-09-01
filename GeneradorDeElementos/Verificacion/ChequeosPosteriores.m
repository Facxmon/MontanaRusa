function [Criterios, Normativo] = ChequeosPosteriores(Track, Sim, Parametros, Layout)
%CHEQUEOSPOSTERIORES Factibilidad que solo se puede evaluar con la geometria.
%   Interferencia, radio real, altura alcanzada, envolvente y limites
%   normativos dependen del recorrido construido.

    Criterios = CriteriosVacios();
    Escala = EscalasDeFroude(Parametros);

    Valido = ~isnan(Sim.Velocidad);
    AlturaRelativa = Track.Puntos(:,3) - Track.Puntos(1,3);

    %% --- El carro completa el elemento -------------------------------------
    Criterios = AgregarCriterio(Criterios, 'El carro completa el elemento', 'MayorOIgual', ...
        double(isempty(Sim.PuntoDeParada)), 1, '-', ...
        'Si falla, el carro se queda sin energia antes del final.');

    Criterios = AgregarCriterio(Criterios, 'G minima sobre el eje vertical del carro', 'MayorOIgual', ...
        min(Sim.Gz(Valido)), Parametros.GMinimaCuspide, 'G', ...
        'Margen en la cuspide. N = 0 no sirve como criterio: no tolera variacion de friccion.');

    %% --- Fabricacion y espacio ---------------------------------------------
    CurvaturaMaxima = max(Track.Curvatura);
    RadioMinimo = 1/max(CurvaturaMaxima, eps);
    Criterios = AgregarCriterio(Criterios, 'Radio de curvatura minimo', 'MayorOIgual', ...
        RadioMinimo, Parametros.RadioMinimoFabricable, 'm', ...
        'Lo limita la impresora 3D.');

    % En los modos que dependen de v el radio del loop es una SALIDA, pero
    % RadioDeReferencia sigue siendo el que fija lambda_loop y con el el presupuesto de
    % onset y la conversion de duraciones. Si el radio que sale se aparta del
    % nominal, esos dos numeros se calcularon con la longitud de referencia
    % equivocada y hay que corregir RadioDeReferencia y regenerar.
    RazonDeRadios = RadioMinimo / Parametros.RadioDeReferencia;
    Criterios = AgregarCriterio(Criterios, 'Radio alcanzado coherente con el nominal', 'MayorOIgual', ...
        min(RazonDeRadios, 1/RazonDeRadios), 0.75, '-', ...
        sprintf(['Radio nominal %.4f m contra alcanzado %.4f m. RadioDeReferencia es la longitud ' ...
                 'caracteristica de Froude: fija lambda_loop, el presupuesto de onset y la ' ...
                 'conversion de duraciones.'], Parametros.RadioDeReferencia, RadioMinimo));

    Criterios = AgregarCriterio(Criterios, 'Altura del loop', 'MenorOIgual', ...
        max(AlturaRelativa), Parametros.AlturaMaximaDelElemento, 'm', ...
        'Medida respecto del punto de entrada del elemento.');

    Criterios = AgregarCriterio(Criterios, 'Altura sobre el suelo', 'MayorOIgual', ...
        min(Track.Puntos(:,3)), Parametros.AlturaMinimaSuelo, 'm');

    Caja = Parametros.BoundingBoxDisponible;
    Sobresale = max([Caja(:,1).' - min(Track.Puntos, [], 1), max(Track.Puntos, [], 1) - Caja(:,2).']);
    Criterios = AgregarCriterio(Criterios, 'Dentro del bounding box disponible', 'MenorOIgual', ...
        Sobresale, 0, 'm', 'Maximo desborde sobre cualquiera de las seis caras.');

    %% --- Interferencia ------------------------------------------------------
    % La envolvente no es un ancho escalar: es una seccion orientada que rota
    % con el roll. Aca se usa la simplificacion conservadora del cilindro que
    % circunscribe la seccion, y ademas se reporta la separacion que exigiria
    % la seccion orientada en el par critico.
    RadioEnvolvente = hypot(Parametros.AnchoVia + 2*Parametros.Holgura, ...
                            Parametros.AltoCarro + 2*Parametros.Holgura) / 2;
    SeparacionExigida = 2*RadioEnvolvente + Parametros.DistanciaMinimaEntreVias;

    [DistanciaPropia, IndicePropioA, IndicePropioB] = DistanciaMinimaEntrePolilineas( ...
        Track.Puntos, Track.Puntos, Track.LongitudArco, Track.LongitudArco, ...
        Parametros.ArcoMinimoAutointerferencia);

    DetalleOrientado = '';
    if isfinite(DistanciaPropia)
        DetalleOrientado = sprintf(['Seccion orientada en el par critico: exigiria %.4f m. ' ...
                                    'Pares vecinos por arco (< %.2f m) excluidos.'], ...
            SeparacionOrientada(Track, IndicePropioA, IndicePropioB, Parametros), ...
            Parametros.ArcoMinimoAutointerferencia);
    end
    Criterios = AgregarCriterio(Criterios, 'Autointerferencia del loop', 'MayorOIgual', ...
        DistanciaPropia, SeparacionExigida, 'm', DetalleOrientado);

    % La longitud de arco es global al layout, asi que la misma exclusion por
    % arco sirve para saltear la junta: el elemento nuevo arranca exactamente
    % donde termina la via anterior y ahi la distancia es cero por
    % construccion, no por interferencia.
    if ~isempty(Layout) && ~isempty(Layout.Puntos)
        DistanciaLayout = DistanciaMinimaEntrePolilineas(Track.Puntos, Layout.Puntos, ...
                                                         Track.LongitudArco, Layout.LongitudArco, ...
                                                         Parametros.ArcoMinimoAutointerferencia);
    else
        DistanciaLayout = Inf;
    end
    Criterios = AgregarCriterio(Criterios, 'Interferencia con la via preexistente', 'MayorOIgual', ...
        DistanciaLayout, SeparacionExigida, 'm', ...
        sprintf(['Distancia segmento a segmento contra toda la polilinea ya construida, ' ...
                 'salteando la junta (pares a menos de %.2f m de arco).'], ...
                Parametros.ArcoMinimoAutointerferencia));

    %% --- Presupuesto de onset por eje --------------------------------------
    Normativo = VerificarLimitesNormativos(Sim, Escala, Parametros);
    Ejes = {'Gx', 'Gy', 'Gz'};
    for i = 1:3
        Criterios = AgregarCriterio(Criterios, sprintf('Onset maximo de %s', Ejes{i}), 'MenorOIgual', ...
            Normativo.OnsetMaximoPorEje(i), Escala.OnsetMaximo(i), 'G/s', ...
            sprintf('Presupuesto del modelo = sqrt(lambda_loop) x %.1f G/s de la norma.', ...
                    Parametros.OnsetNormativoPorEje(i)));
    end

    Criterios = AgregarCriterio(Criterios, 'Onset de 0 G a 2 G (7.1.7.2)', 'MenorOIgual', ...
        Normativo.OnsetDeCarga, Escala.OnsetMaximo(3), 'G/s', ...
        'Alcance literal de la clausula: solo transiciones desde 0 G o menos hacia 2 G o mas.');

    %% --- Limites normativos dependientes de la duracion --------------------
    Criterios = AgregarCriterioNormativo(Criterios, '+Gz (Fig. 10)',   Normativo.MasGz);
    Criterios = AgregarCriterioNormativo(Criterios, '-Gz (Fig. 9)',    Normativo.MenosGz);
    Criterios = AgregarCriterioNormativo(Criterios, 'Gy (Fig. 8)',     Normativo.Gy);
    Criterios = AgregarCriterioNormativo(Criterios, '+Gx (Fig. 6)',    Normativo.MasGx);
    Criterios = AgregarCriterioNormativo(Criterios, '-Gx (Fig. 7)',    Normativo.MenosGx);

    Criterios = AgregarCriterio(Criterios, 'Elipse de dos ejes Gy-Gz (7.1.5.1)', 'MenorOIgual', ...
        Normativo.Elipse.ValorMaximoGyGz, 1, '-', ...
        'Semiejes iguales a los limites de 200 ms multiplicados por 1.1.');
    Criterios = AgregarCriterio(Criterios, 'Elipse de dos ejes Gx-Gz (7.1.5.1)', 'MenorOIgual', ...
        Normativo.Elipse.ValorMaximoGxGz, 1, '-');
    Criterios = AgregarCriterio(Criterios, 'Elipse de dos ejes Gx-Gy (7.1.5.1)', 'MenorOIgual', ...
        Normativo.Elipse.ValorMaximoGxGy, 1, '-');
end

%% ========================= auxiliares =====================================
function Criterios = AgregarCriterioNormativo(Criterios, Nombre, Evento)
    if ~isfinite(Evento.Exceso)
        Criterios = AgregarCriterio(Criterios, Nombre, 'Informativo', Evento.PicoG, NaN, 'G', ...
            'Ningun evento sostenido supera los 200 ms: fuera del alcance de la norma (7.1.4.2).');
        return
    end
    Criterios = AgregarCriterio(Criterios, Nombre, 'MenorOIgual', Evento.Exceso, 0, 'G', ...
        sprintf('Nivel critico %.2f G sostenido %.2f s equivalentes reales; limite %.2f G.', ...
                Evento.NivelCritico, Evento.DuracionReal, Evento.LimiteAplicado));
end

function Separacion = SeparacionOrientada(Track, IndiceA, IndiceB, Parametros)
%SEPARACIONORIENTADA Separacion que exigiria la seccion orientada en un par
%   de segmentos, en vez del cilindro circunscripto. La seccion es una caja
%   de AnchoVia x AltoCarro mas holgura, barrida a lo largo de T y rotada con
%   el roll, asi que su semiancho en una direccion dada es la funcion soporte
%   de la caja sobre esa direccion.

    Direccion = Track.Puntos(IndiceB,:) - Track.Puntos(IndiceA,:);
    if norm(Direccion) < 1e-12
        Separacion = Inf;
        return
    end
    Direccion = Direccion / norm(Direccion);

    SemiAncho = Parametros.AnchoVia/2  + Parametros.Holgura;
    SemiAlto  = Parametros.AltoCarro/2 + Parametros.Holgura;

    Soporte = @(i) SemiAncho*abs(dot(Direccion, Track.VersorLateral(i,:))) ...
                 + SemiAlto *abs(dot(Direccion, Track.VersorArribaCarro(i,:)));

    Separacion = Soporte(IndiceA) + Soporte(IndiceB) + Parametros.DistanciaMinimaEntreVias;
end
