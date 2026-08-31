function [Registro, y, Arco, PasosDados] = IntegrarTramo(Registro, y, Arco, Contexto, Longitud, CondicionDeParada)
%INTEGRARTRAMO Integra un sub-tramo y va volcando los nodos en el registro.
%   El nodo final del tramo no se registra aca: queda como primer nodo del
%   tramo siguiente, de modo que la lista de nodos no tenga duplicados. El
%   ultimo nodo del elemento lo agrega el generador.

    Parametros = Contexto.Parametros;
    ArcoInicial = Arco;
    PasosDados  = 0;

    while (Arco - ArcoInicial) < Longitud - 1e-12
        Paso = min(Parametros.PasoGeneracion, Longitud - (Arco - ArcoInicial));
        [EstadoSiguiente, Punto] = PasoRK4(Arco, y, Paso, Contexto);

        if ~isempty(CondicionDeParada) && CondicionDeParada(Punto)
            break
        end

        Registro = AgregarNodo(Registro, Punto);
        y    = EstadoSiguiente;
        Arco = Arco + Paso;
        PasosDados = PasosDados + 1;

        if mod(PasosDados, Parametros.PasosEntreOrtonormalizaciones) == 0
            [T, U, L] = Ortonormalizar(y(4:6), y(7:9));
            y(4:12) = [T, U, L];
        end

        if y(13) <= 0
            break   % el carro se quedo sin energia dentro del tramo
        end
    end
end
