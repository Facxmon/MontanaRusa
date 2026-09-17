function Criterios = ChequeosPrevios(EstadoEntrada, Parametros, Receta)
%CHEQUEOSPREVIOS Factibilidad evaluable ANTES de construir la geometria.
%   Son los que dependen solo del estado de entrada y de los parametros. Los
%   que necesitan la geometria -- interferencia, radio minimo real, altura
%   alcanzada, limites normativos -- van en ChequeosPosteriores: no se pueden
%   evaluar sin generar, y eso hay que decirlo en vez de fingir lo contrario.

    Criterios = CriteriosVacios();
    g = Parametros.Gravedad;

    %% --- Compatibilidad del estado de entrada -----------------------------
    ProyeccionHorizontal = norm(EstadoEntrada.VersorTangente(1:2));
    Criterios = AgregarCriterio(Criterios, 'Tangente de entrada no vertical', 'MayorOIgual', ...
        ProyeccionHorizontal, 1e-6, '-', ...
        'Con la tangente vertical pura el plano del elemento queda indeterminado: hay que dar el azimut.');

    Pitch = asin(max(min(EstadoEntrada.VersorTangente(3), 1), -1));
    Criterios = AgregarCriterio(Criterios, 'Pitch de entrada no descendente', 'MayorOIgual', ...
        rad2deg(Pitch), -15, 'grados', ...
        'Con pitch bajando fuerte esto no es un loop vertical estandar sino un dive loop.');

    NormalEnPlano = NormalDelPlanoVertical(EstadoEntrada.VersorTangente, ProyeccionHorizontal);
    CurvaturaEnPlano = dot(EstadoEntrada.VectorCurvatura, NormalEnPlano);
    CurvaturaFueraPlano = dot(EstadoEntrada.VectorCurvatura, ...
                              cross(EstadoEntrada.VersorTangente, NormalEnPlano));

    Criterios = AgregarCriterio(Criterios, 'Curvatura de entrada dentro del plano', 'Informativo', ...
        CurvaturaEnPlano, NaN, '1/m', ...
        'Si no es nula se usa clotoide desplazada, que arranca en kappa_0 en vez de en cero.');
    Criterios = AgregarCriterio(Criterios, 'Curvatura de entrada fuera del plano', 'Informativo', ...
        CurvaturaFueraPlano, NaN, '1/m', ...
        'Si no es nula se inserta un tramo de acondicionamiento que la lleva a cero.');

    % Misma regla que GenerarGeometria: la diferencia cruda se conserva si ya
    % esta en [-pi, pi] y se envuelve al camino corto si la supera.
    Beta = AnguloEntreNormalYTransporte(EstadoEntrada, NormalEnPlano);
    DeltaRoll = Beta + Receta.RollDelElemento - EstadoEntrada.AnguloRoll;
    if abs(DeltaRoll) > pi + 1e-9
        DeltaRoll = mod(DeltaRoll + pi, 2*pi) - pi;
    end
    Criterios = AgregarCriterio(Criterios, 'Roll de entrada compatible', 'Informativo', ...
        rad2deg(DeltaRoll), NaN, 'grados', ...
        'Si no es cero se inserta una transicion de roll con smoothstep quintico.');

    %% --- Factibilidad energetica (estimacion a priori) --------------------
    % Cota de arranque, no el resultado: el chequeo exacto sale de la geometria
    % generada. El coseno del desfasaje dice cuanto del giro es vertical: vale
    % 1 en un loop (sube 2*R), -1 en un dive loop (baja) y 0 en un giro
    % horizontal, que a esta altura no sube nada.
    RadioNominal    = Parametros.RadioDeReferencia;
    FraccionVertical = max(cos(Receta.DesfasajeDeCurvatura), 0);
    AlturaCuspide    = RadioNominal * (1 - cos(min(Receta.GiroObjetivo, pi))) * FraccionVertical;
    VelocidadCuspideCuadrado = (Parametros.GMinimaCuspide + FraccionVertical)*g*RadioNominal;
    VelocidadMinimaEstimada  = sqrt(VelocidadCuspideCuadrado + 2*g*AlturaCuspide);

    Criterios = AgregarCriterio(Criterios, 'Velocidad de entrada suficiente (estimada)', 'MayorOIgual', ...
        EstadoEntrada.Velocidad, VelocidadMinimaEstimada, 'm/s', ...
        'Estimacion sin perdidas sobre un arco circular de radio nominal.');

    Criterios = AgregarCriterio(Criterios, 'Altura estimada del elemento', 'MenorOIgual', ...
        AlturaCuspide, Parametros.AlturaMaximaDelElemento, 'm', ...
        'Estimacion con el radio nominal; la altura real sale de la geometria.');

    Criterios = AgregarCriterio(Criterios, 'Radio nominal fabricable', 'MayorOIgual', ...
        RadioNominal, Parametros.RadioMinimoFabricable, 'm', ...
        'En los modos que dependen de v el radio real puede ser menor: ver el chequeo posterior.');
end

%% ========================= auxiliares =====================================
function Normal = NormalDelPlanoVertical(VersorTangente, ProyeccionHorizontal)
    if ProyeccionHorizontal < 1e-9
        Normal = [0 0 1];
        return
    end
    Horizontal = [VersorTangente(1), VersorTangente(2), 0] / ProyeccionHorizontal;
    Normal = -VersorTangente(3)*Horizontal + ProyeccionHorizontal*[0 0 1];
    Normal = Normal / norm(Normal);
end

function Beta = AnguloEntreNormalYTransporte(EstadoEntrada, NormalEnPlano)
    [ArribaTransporte, LateralTransporte] = MarcoTransporteDesdeCarro( ...
        EstadoEntrada.VersorArribaCarro, EstadoEntrada.VersorLateral, EstadoEntrada.AnguloRoll);
    Beta = atan2(dot(NormalEnPlano, LateralTransporte), dot(NormalEnPlano, ArribaTransporte));
end
