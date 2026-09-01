function Comparacion = CompararMetodos(EstadoEntrada, Parametros, Receta, Imprimir)
%COMPARARMETODOS Corre los dos metodos de acoplamiento sobre el mismo caso.
%   Reporta diferencia de geometria punto a punto, diferencia de perfil de G,
%   tiempo de computo e iteraciones del punto fijo.
%
%   Test clave: en el modo Clotoide la curvatura no depende de v, asi que los
%   dos metodos tienen que dar lo mismo. Si difieren mas que la tolerancia de
%   convergencia del punto fijo, hay un bug.

    if nargin < 4
        Imprimir = true;
    end

    [TrackA, DiagnosticoA] = ResolverMetodoA(EstadoEntrada, Parametros, Receta);
    [TrackB, DiagnosticoB] = ResolverMetodoB(EstadoEntrada, Parametros, Receta);

    SimA = SimularSobreTrack(TrackA, EstadoEntrada, Parametros);
    SimB = SimularSobreTrack(TrackB, EstadoEntrada, Parametros);

    ArcoComun = linspace(0, min(TrackA.LongitudArco(end), TrackB.LongitudArco(end)), 2000).';
    PuntosA = InterpolarFilas(TrackA.LongitudArco, TrackA.PuntosHeartline, ArcoComun);
    PuntosB = InterpolarFilas(TrackB.LongitudArco, TrackB.PuntosHeartline, ArcoComun);

    Comparacion.ModoCurvatura        = Parametros.ModoCurvatura;
    Comparacion.DiferenciaGeometrica = max(vecnorm(PuntosA - PuntosB, 2, 2));
    Comparacion.DiferenciaGz = MaximaDiferencia(TrackA.LongitudArco, SimA.Gz, TrackB.LongitudArco, SimB.Gz, ArcoComun);
    Comparacion.DiferenciaGy = MaximaDiferencia(TrackA.LongitudArco, SimA.Gy, TrackB.LongitudArco, SimB.Gy, ArcoComun);
    Comparacion.DiferenciaGx = MaximaDiferencia(TrackA.LongitudArco, SimA.Gx, TrackB.LongitudArco, SimB.Gx, ArcoComun);
    Comparacion.DiferenciaVelocidad = MaximaDiferencia(TrackA.LongitudArco, SimA.Velocidad, ...
                                                       TrackB.LongitudArco, SimB.Velocidad, ArcoComun);
    Comparacion.DiferenciaLongitud = TrackA.LongitudArco(end) - TrackB.LongitudArco(end);

    Comparacion.TiempoMetodoA      = DiagnosticoA.TiempoDeComputo;
    Comparacion.TiempoMetodoB      = DiagnosticoB.TiempoDeComputo;
    Comparacion.IteracionesMetodoB = DiagnosticoB.IteracionesPuntoFijo;
    Comparacion.ResiduoMetodoB     = DiagnosticoB.ResiduoPuntoFijo;
    Comparacion.TrackA = TrackA;
    Comparacion.TrackB = TrackB;
    Comparacion.DiagnosticoA = DiagnosticoA;
    Comparacion.DiagnosticoB = DiagnosticoB;

    if Imprimir
        fprintf('\n--- Comparacion de metodos, modo %s ---\n', Comparacion.ModoCurvatura);
        fprintf('  Diferencia maxima de geometria : %10.3e m\n', Comparacion.DiferenciaGeometrica);
        fprintf('  Diferencia maxima de velocidad : %10.3e m/s\n', Comparacion.DiferenciaVelocidad);
        fprintf('  Diferencia maxima de Gz        : %10.3e G\n', Comparacion.DiferenciaGz);
        fprintf('  Diferencia maxima de Gy        : %10.3e G\n', Comparacion.DiferenciaGy);
        fprintf('  Diferencia de longitud total   : %10.3e m\n', Comparacion.DiferenciaLongitud);
        fprintf('  Tiempo metodo A                : %8.3f s\n', Comparacion.TiempoMetodoA);
        fprintf('  Tiempo metodo B                : %8.3f s  (%d iteraciones, residuo %.2e m/s)\n', ...
                Comparacion.TiempoMetodoB, Comparacion.IteracionesMetodoB, Comparacion.ResiduoMetodoB);
    end
end

function Valores = InterpolarFilas(Arco, Matriz, ArcoNuevo)
    Valores = interp1(Arco, Matriz, ArcoNuevo, 'linear', 'extrap');
end

function Diferencia = MaximaDiferencia(ArcoA, ValoresA, ArcoB, ValoresB, ArcoComun)
    a = interp1(ArcoA, ValoresA, ArcoComun, 'linear', 'extrap');
    b = interp1(ArcoB, ValoresB, ArcoComun, 'linear', 'extrap');
    Diferencia = max(abs(a - b));
end
