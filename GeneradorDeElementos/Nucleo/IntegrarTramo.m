function [Registro, y, Arco, PasosDados] = IntegrarTramo(Registro, y, Arco, Contexto, Longitud, DistanciaHastaParar)
%INTEGRARTRAMO Integra un sub-tramo y va volcando los nodos en el registro.
%   El nodo final del tramo no se registra aca: queda como primer nodo del
%   tramo siguiente, de modo que la lista de nodos no tenga duplicados. El
%   ultimo nodo del elemento lo agrega el generador.
%
%   DistanciaHastaParar es opcional y devuelve, para el punto actual y el
%   registro de nodos ya integrados, cuanto arco falta para el corte. Cuando
%   falta menos que un paso se acorta el ultimo paso para caer justo: si
%   no, el corte queda cuantizado por el paso y el residual de cierre del
%   loop no puede bajar de kappa*ds. Recibe el registro porque la
%   prediccion del giro de la rampa de salida necesita dkappa/ds, que se
%   estima con el ultimo nodo.

    Parametros  = Contexto.Parametros;
    ArcoInicial = Arco;
    PasosDados  = 0;

    while (Arco - ArcoInicial) < Longitud - 1e-12
        [~, Punto] = DerivadaDeVia(Arco, y, Contexto);

        Paso = min(Parametros.PasoGeneracion, Longitud - (Arco - ArcoInicial));
        UltimoPaso = false;

        if ~isempty(DistanciaHastaParar)
            Restante = DistanciaHastaParar(Punto, Registro);
            if Restante <= 0
                break
            elseif Restante < Paso
                Paso = Restante;
                UltimoPaso = true;
            end
        end

        Registro = AgregarNodo(Registro, Punto);
        y    = PasoRK4(Arco, y, Paso, Contexto);
        Arco = Arco + Paso;
        PasosDados = PasosDados + 1;

        if mod(PasosDados, Parametros.PasosEntreOrtonormalizaciones) == 0
            [T, U, L] = Ortonormalizar(y(4:6), y(7:9));
            y(4:12) = [T, U, L];
        end

        if UltimoPaso || y(13) <= 0
            break   % corte pedido, o el carro se quedo sin energia
        end
    end
end
