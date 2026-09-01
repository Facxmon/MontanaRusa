function ReportarElemento(Reporte, Elemento)
%REPORTARELEMENTO Imprime el reporte estructurado del elemento.

    Resumen = Reporte.Resumen;

    fprintf('\n=====================================================================\n');
    fprintf(' %s -- giro %.0f grados -- modo %s -- metodo %s\n', Elemento.Nombre, ...
            rad2deg(Elemento.Receta.GiroObjetivo), Elemento.Track.ModoCurvatura, Resumen.Metodo);
    fprintf('=====================================================================\n');

    fprintf('\n--- Geometria y recorrido ---\n');
    fprintf('  Longitud recorrida            : %8.4f m\n', Resumen.LongitudRecorrida);
    fprintf('  Longitud de material de via   : %8.4f m\n', Resumen.LongitudDeMaterial);
    fprintf('  Altura maxima sobre la entrada: %8.4f m\n', Resumen.AlturaMaxima);
    fprintf('  Radio de curvatura minimo     : %8.4f m\n', Resumen.RadioMinimo);
    fprintf('  Tiempo de recorrido           : %8.4f s\n', Resumen.TiempoDeRecorrido);

    fprintf('\n--- Sub-tramos ---\n');
    for i = 1:numel(Elemento.SubTramos)
        Tramo = Elemento.SubTramos(i);
        ArcoInicio = Elemento.Track.LongitudArco(Tramo.IndiceInicio);
        ArcoFin    = Elemento.Track.LongitudArco(Tramo.IndiceFin);
        fprintf('  %-26s nodos %5d..%5d   s = %6.4f .. %6.4f m  (%6.4f m)\n', ...
                Tramo.Nombre, Tramo.IndiceInicio, Tramo.IndiceFin, ArcoInicio, ArcoFin, ArcoFin-ArcoInicio);
    end

    fprintf('\n--- Dinamica ---\n');
    fprintf('  Velocidad de entrada          : %8.4f m/s\n', Elemento.EstadoEntrada.Velocidad);
    fprintf('  Velocidad minima              : %8.4f m/s\n', Resumen.VelocidadMinima);
    fprintf('  Velocidad de salida           : %8.4f m/s\n', Elemento.EstadoSalida.Velocidad);
    fprintf('  Velocidad inicial minima      : %8.4f m/s   (%s)\n', ...
            Resumen.VelocidadInicialMinima, Resumen.BusquedaVelocidad.Motivo);
    fprintf('  Gz maxima / minima            : %8.4f / %.4f G\n', Resumen.GzMaxima, Resumen.GzMinima);
    fprintf('  |Gy| maxima                   : %8.4f G\n', Resumen.GyMaximaAbsoluta);
    fprintf('  Fuerza normal maxima sobre via: %8.4f N\n', Resumen.FuerzaNormalMaxima);
    fprintf('  Energia disipada rodadura     : %8.5f J\n', Resumen.EnergiaDisipadaRodadura);
    fprintf('  Energia disipada arrastre     : %8.5f J\n', Resumen.EnergiaDisipadaArrastre);

    fprintf('\n--- Cierre y empalme (nunca se asumen cero) ---\n');
    fprintf('  Residual de pitch tras 2*pi   : %10.3e rad\n', Resumen.ResidualCierrePitch);
    fprintf('  Residual de tangente          : %10.3e\n',     Resumen.ResidualCierreTangente);
    fprintf('  Salto de posicion en empalme  : %10.3e m\n',   Resumen.SaltoDePosicion);
    fprintf('  Salto de tangente en empalme  : %10.3e\n',     Resumen.SaltoDeTangente);
    fprintf('  Salto de curvatura en empalme : %10.3e 1/m\n', Resumen.SaltoDeCurvatura);
    fprintf('  Posicion final                : [%.5f %.5f %.5f] m\n', Resumen.PosicionFinal);

    fprintf('\n--- Salida del plano de giro (inclinacion helicoidal) ---\n');
    fprintf('  Inclinacion helicoidal        : %8.4f   (%.2f grados)\n', ...
            Resumen.InclinacionHelicoidal, rad2deg(atan(Resumen.InclinacionHelicoidal)));
    fprintf('  Avance sobre el eje           : %8.4f m   (objetivo %.4f m)\n', ...
            Resumen.DesplazamientoLateral, Resumen.DesplazamientoLateralObjetivo);
    % Los dos numeros de roll miden lo mismo contra referencias distintas. El
    % primero crece porque el marco de transporte gira con la torsion; el
    % segundo es el que se ve mirando la via, y termina en cero: el carro sale
    % derecho aunque el angulo de roll no valga cero.
    fprintf('  Roll final contra el marco    : %8.2f grados\n', rad2deg(Elemento.EstadoSalida.AnguloRoll));
    fprintf('  Peralte final contra vertical : %8.2f grados\n', rad2deg(Resumen.PeralteFinal));

    fprintf('\n--- Escalado (modelo distorsionado) ---\n');
    fprintf('  lambda del loop               : %8.3f\n', Resumen.LambdaLoop);
    fprintf('  lambda del carro              : %8.3f\n', Resumen.LambdaCarro);
    fprintf('  Distorsion (lambda_c/lambda_l): %8.3f\n', Resumen.Distorsion);
    fprintf('  Equivalente en carros reales  : %8.3f\n', Resumen.CarrosEquivalentes);
    fprintf('  Presupuesto de onset [Gx Gy Gz]: %.1f  %.1f  %.1f G/s\n', Resumen.OnsetMaximoModelo);

    if isfield(Reporte, 'Comparacion') && ~isempty(Reporte.Comparacion)
        Comparacion = Reporte.Comparacion;
        fprintf('\n--- Comparacion de metodos de acoplamiento ---\n');
        fprintf('  Diferencia maxima de geometria: %10.3e m\n', Comparacion.DiferenciaGeometrica);
        fprintf('  Diferencia maxima de Gz       : %10.3e G\n', Comparacion.DiferenciaGz);
        fprintf('  Metodo A                      : %8.2f s\n', Comparacion.TiempoMetodoA);
        fprintf('  Metodo B                      : %8.2f s  (%d iteraciones)\n', ...
                Comparacion.TiempoMetodoB, Comparacion.IteracionesMetodoB);
    end

    ImprimirCriterios('Chequeos previos (solo dependen del estado de entrada)', Reporte.Previos);
    ImprimirCriterios('Chequeos posteriores (necesitan la geometria generada)', Reporte.Posteriores);

    Fallados = [Reporte.Previos([Reporte.Previos.Pasa] == false), ...
                Reporte.Posteriores([Reporte.Posteriores.Pasa] == false)];
    fprintf('\n  %d criterios evaluados, %d no pasan.\n', ...
            numel(Reporte.Previos) + numel(Reporte.Posteriores), numel(Fallados));
end

function ImprimirCriterios(Titulo, Criterios)
    fprintf('\n--- %s ---\n', Titulo);
    for i = 1:numel(Criterios)
        Criterio = Criterios(i);
        if strcmp(Criterio.Sentido, 'Informativo')
            Estado = ' -- ';
            TextoMargen = '        ';
        elseif Criterio.Pasa
            Estado = 'PASA';
            TextoMargen = sprintf('%+8.4g', Criterio.Margen);
        else
            Estado = 'FALLA';
            TextoMargen = sprintf('%+8.4g', Criterio.Margen);
        end
        fprintf('  [%-5s] %-42s valor %10.4g %-6s  margen %s\n', ...
                Estado, Criterio.Nombre, Criterio.Valor, Criterio.Unidad, TextoMargen);
        if ~isempty(Criterio.Detalle)
            fprintf('           %s\n', Criterio.Detalle);
        end
    end
end
