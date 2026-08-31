function [Track, Diagnostico] = ResolverMetodoB(EstadoEntrada, Parametros)
%RESOLVERMETODOB Punto fijo sobre el perfil de velocidad.
%   1. Suponer un perfil v(s) (se arranca con v constante = v_0)
%   2. Generar la geometria completa con ese perfil
%   3. Obtener el v(s) que resulta de esa geometria
%   4. Repetir hasta convergencia
%
%   A favor: separa la forma del perfil de velocidad, que es lo que hace
%   falta para poder imponer un perfil de diseno o resolver hacia atras.
%   En contra: hay que iterar, y con modos muy sensibles a v puede necesitar
%   relajacion.
%
%   En el modo Clotoide la curvatura no depende de v, asi que converge y da
%   lo mismo que el metodo A. Ojo con el matiz: la curvatura no depende de v
%   pero las LONGITUDES de las clotoides si, porque salen del presupuesto de
%   onset (L = DeltaG*v/Onset). Por eso el modo Clotoide igual necesita mas de
%   una iteracion, aunque converja al mismo resultado que el metodo A.

    Cronometro = tic;

    ArcoInicial = EstadoEntrada.LongitudAcumulada;
    ArcoSupuesto      = [ArcoInicial; ArcoInicial + 100];
    VelocidadSupuesta = [EstadoEntrada.Velocidad; EstadoEntrada.Velocidad];

    Residuo = Inf;
    for Iteracion = 1:Parametros.MaxIteracionesPuntoFijo
        Interpolante = InterpolanteDeVelocidad(ArcoSupuesto, VelocidadSupuesta);
        [Track, Diagnostico] = GenerarLoopVertical(EstadoEntrada, Parametros, Interpolante);

        ArcoNuevo      = Diagnostico.PerfilVelocidad.Arco;
        VelocidadNueva = Diagnostico.PerfilVelocidad.Velocidad;
        Residuo = max(abs(VelocidadNueva - Interpolante(ArcoNuevo)));

        ArcoSupuesto      = ArcoNuevo;
        VelocidadSupuesta = VelocidadNueva;
        if Residuo < Parametros.TolPuntoFijo
            break
        end
    end

    Diagnostico.Metodo               = 'B - punto fijo';
    Diagnostico.IteracionesPuntoFijo = Iteracion;
    Diagnostico.ResiduoPuntoFijo     = Residuo;
    Diagnostico.TiempoDeComputo      = toc(Cronometro);

    if Residuo >= Parametros.TolPuntoFijo
        warning('ResolverMetodoB:SinConvergencia', ...
                'El punto fijo no converge: residuo %.3e m/s tras %d iteraciones.', Residuo, Iteracion);
    end
end

function Interpolante = InterpolanteDeVelocidad(Arco, Velocidad)
%INTERPOLANTEDEVELOCIDAD Interpolante pchip precompilado del perfil supuesto.
%   Se construye una sola vez por iteracion: dentro de RK4 se evalua decenas
%   de miles de veces y rehacer el ajuste en cada llamada seria carisimo.
    [ArcoUnico, Indices] = unique(Arco(:), 'stable');
    Interpolante = griddedInterpolant(ArcoUnico, Velocidad(Indices), 'pchip', 'linear');
end
