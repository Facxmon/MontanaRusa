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

    % El ultimo paso de un tramo se acorta para caer justo en su longitud
    % (o en el corte), pero nunca se deja una astilla: si lo que falta es
    % menos de un paso y medio se toma entero ahora, asi que el ultimo paso
    % queda entre 0.5 y 1.5 pasos. Una astilla de microns entre dos nodos
    % no cambia la geometria, pero las derivadas numericas sobre la
    % polilinea (phi'' y el jerk, que son segundas diferencias) se
    % amplifican con la razon entre pasos vecinos y en el borde del
    % elemento daban picos de jerk que no existian.
    PasoNominal = Parametros.PasoGeneracion;
    while (Arco - ArcoInicial) < Longitud - 1e-12
        [~, Punto] = DerivadaDeVia(Arco, y, Contexto);

        Paso = PasoSinAstilla(PasoNominal, Longitud - (Arco - ArcoInicial));
        UltimoPaso = false;

        if ~isempty(DistanciaHastaParar)
            Restante = DistanciaHastaParar(Punto, Registro);
            if Restante <= 0
                break
            elseif Restante < 1.5*PasoNominal
                Paso = Restante;   % cae justo en el corte, con un paso de a lo sumo 1.5 pasos
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

function Paso = PasoSinAstilla(PasoNominal, Faltante)
%PASOSINASTILLA Paso nominal, salvo que lo que falta del tramo sea menos de
%   un paso y medio: entonces se toma todo lo que falta, para que el ultimo
%   paso quede entre 0.5 y 1.5 pasos y no deje una astilla.
    if Faltante < 1.5*PasoNominal
        Paso = Faltante;
    else
        Paso = PasoNominal;
    end
end
