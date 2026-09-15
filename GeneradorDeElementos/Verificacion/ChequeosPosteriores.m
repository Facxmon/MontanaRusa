function [Criterios, Normativo] = ChequeosPosteriores(Track, Sim, Parametros, Layout)
%CHEQUEOSPOSTERIORES Factibilidad que solo se puede evaluar con la geometria.
%   Interferencia, radio real, altura alcanzada, envolvente y limites
%   normativos dependen del recorrido construido.
%
%   Que curva usa cada chequeo NO es intercambiable:
%     riel       todo lo fisico -- interferencia, bounding box, altura sobre
%                el suelo, radio minimo fabricable. Es la pieza que se imprime
%                y la curva integrada, asi que su curvatura es exacta.
%     heartline  todo lo de intencion de diseno y de confort -- limites
%                normativos, radio nominal, altura del elemento. Es donde va
%                el pasajero; se deriva del riel sumando d*U.

    Criterios = CriteriosVacios();
    Escala = EscalasDeFroude(Parametros);

    Valido = ~isnan(Sim.Velocidad);
    AlturaRelativa = Track.PuntosHeartline(:,3) - Track.PuntosHeartline(1,3);

    %% --- El carro completa el elemento -------------------------------------
    Criterios = AgregarCriterio(Criterios, 'El carro completa el elemento', 'MayorOIgual', ...
        double(isempty(Sim.PuntoDeParada)), 1, '-', ...
        'Si falla, el carro se queda sin energia antes del final.');

    Criterios = AgregarCriterio(Criterios, 'G minima sobre el eje vertical del carro', 'MayorOIgual', ...
        min(Sim.Gz(Valido)), Parametros.GMinimaCuspide, 'G', ...
        sprintf(['Margen en la cuspide, en el punto de verificacion (%s, brazo %.3f m). ' ...
                 'N = 0 no sirve como criterio: no tolera variacion de friccion.'], ...
                Parametros.PuntoDeVerificacionNormativa, Sim.BrazoDeVerificacion));

    %% --- Fabricacion y espacio ---------------------------------------------
    % El radio que limita la impresora es el DEL RIEL, que no es el de la
    % heartline: la heartline va desplazada +d*U y su curvatura es otra.
    RadioMinimoRiel = 1/max(max(Track.Curvatura),          eps);
    RadioMinimo     = 1/max(max(Track.CurvaturaHeartline), eps);
    Criterios = AgregarCriterio(Criterios, 'Radio de curvatura minimo del riel', 'MayorOIgual', ...
        RadioMinimoRiel, Parametros.RadioMinimoFabricable, 'm', ...
        sprintf(['Lo limita la impresora 3D. Es el radio del riel (%.4f m), no el del ' ...
                 'heartline (%.4f m): el offset de %.3f m los separa.'], ...
                RadioMinimoRiel, RadioMinimo, Parametros.DistanciaHeartline));

    % En los modos que dependen de v el radio del loop es una SALIDA, pero
    % RadioDeReferencia sigue siendo el que fija lambda_loop y con el el presupuesto de
    % onset y la conversion de duraciones. Si el radio que sale se aparta del
    % nominal, esos dos numeros se calcularon con la longitud de referencia
    % equivocada y hay que corregir RadioDeReferencia y regenerar.
    % El radio nominal es intencion de diseno: los modos de curvatura resuelven
    % el radio para que el PASAJERO reciba la G objetivo, asi que lo que hay
    % que contrastar contra el nominal es el radio del heartline.
    RazonDeRadios = RadioMinimo / Parametros.RadioDeReferencia;
    Criterios = AgregarCriterio(Criterios, 'Radio alcanzado coherente con el nominal', 'MayorOIgual', ...
        min(RazonDeRadios, 1/RazonDeRadios), 0.75, '-', ...
        sprintf(['Radio nominal %.4f m contra alcanzado %.4f m, los dos sobre el heartline. ' ...
                 'RadioDeReferencia es la longitud caracteristica de Froude: fija lambda_loop, ' ...
                 'el presupuesto de onset y la conversion de duraciones.'], ...
                Parametros.RadioDeReferencia, RadioMinimo));

    Criterios = AgregarCriterio(Criterios, 'Altura del loop', 'MenorOIgual', ...
        max(AlturaRelativa), Parametros.AlturaMaximaDelElemento, 'm', ...
        'Medida sobre el heartline, respecto del punto de entrada del elemento.');

    Criterios = AgregarCriterio(Criterios, 'Altura del riel sobre el suelo', 'MayorOIgual', ...
        min(Track.PuntosRiel(:,3)), Parametros.AlturaMinimaSuelo, 'm', ...
        'Sobre el riel: es la pieza que efectivamente puede tocar el piso.');

    Caja = Parametros.BoundingBoxDisponible;
    Sobresale = max([Caja(:,1).' - min(Track.PuntosRiel, [], 1), max(Track.PuntosRiel, [], 1) - Caja(:,2).']);
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

    % Toda la interferencia se mide sobre el RIEL: es la pieza fisica que se
    % puede chocar con otra. El heartline es un lugar geometrico y no ocupa
    % lugar.
    [DistanciaPropia, IndicePropioA, IndicePropioB] = DistanciaMinimaEntrePolilineas( ...
        Track.PuntosRiel, Track.PuntosRiel, Track.LongitudArco, Track.LongitudArco, ...
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
    if ~isempty(Layout) && ~isempty(Layout.PuntosRiel)
        DistanciaLayout = DistanciaMinimaEntrePolilineas(Track.PuntosRiel, Layout.PuntosRiel, ...
                                                         Track.LongitudArco, Layout.LongitudArcoRiel, ...
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

    %% --- Cabeza: informativo -----------------------------------------------
    % La norma no se aplica en la cabeza, pero es la parte mas sensible a las
    % rotaciones y el disenador debe incluirlas (Rohde 2024, 7.6.2). Si
    % PuntoDeVerificacionNormativa es 'Cabeza' estas son las mismas que arriba.
    Criterios = AgregarCriterio(Criterios, 'Gz maxima en la cabeza', 'Informativo', ...
        max(Sim.GzCabeza(Valido)), NaN, 'G', ...
        sprintf('A %.3f m del riel (d + e). Las verificadas arriba estan a %.3f m.', ...
                Parametros.DistanciaHeartline + Parametros.DistanciaHeartlineACabeza, Sim.BrazoDeVerificacion));
    Criterios = AgregarCriterio(Criterios, '|Gy| maxima en la cabeza', 'Informativo', ...
        max(abs(Sim.GyCabeza(Valido))), NaN, 'G', '');
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

    Direccion = Track.PuntosRiel(IndiceB,:) - Track.PuntosRiel(IndiceA,:);
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
