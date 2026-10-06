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

    AlturaRelativa = Track.PuntosHeartline(:,3) - Track.PuntosHeartline(1,3);

    %% --- El carro completa el elemento -------------------------------------
    Criterios = [Criterios, CriteriosDeMarcha(Sim, Parametros)];

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

    %% --- Tren: interferencia entre carros y angulo del acople --------------
    % Solo con mas de un carro. Dependen de la geometria, no de la dinamica.
    if round(Parametros.NumeroDeCarros) > 1
        Criterios = [Criterios, CriteriosDelTren(Track, Parametros)];
    end

    %% --- Presupuesto de onset por eje --------------------------------------
    Normativo = VerificarLimitesNormativos(Sim, Escala, Parametros);
    Criterios = [Criterios, CriteriosDeOnset(Normativo, Escala, Parametros)];

    %% --- Limites normativos: duracion, reversiones y elipses ---------------
    % Para el elemento suelto. Si el elemento entra a un layout,
    % VerificarLayoutNormativo recalcula este bloque sobre la linea de tiempo
    % continua del circuito y reemplaza estas mismas lineas.
    Criterios = [Criterios, CriteriosNormativos(Normativo)];

    %% --- Cabeza: informativo -----------------------------------------------
    Criterios = [Criterios, CriteriosDeCabeza(Sim, Parametros)];
end

%% ========================= auxiliares =====================================
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
