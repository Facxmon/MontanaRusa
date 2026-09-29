function Punto = RollHaciaLaFuerza(Punto, Contexto)
%ROLLHACIALAFUERZA Roll que alinea el eje del carro con la fuerza especifica.
%   Peralte alineado a la fuerza (PeralteDelElemento, GenerarGeometria). La
%   fuerza especifica del riel en el plano normal es F = v^2*kappa + g*z; en
%   el marco de transporte, con kappa = kU*Upt + kL*Lpt,
%       F.Upt = v^2*kU + g*Upt_z,     F.Lpt = v^2*kL + g*Lpt_z,
%   y como U = cos(phi)*Upt + sin(phi)*Lpt, el roll que pone U sobre F es
%   atan2(F.Lpt, F.Upt). Se alinea el eje (AlEjeDeLaFuerza, alrededor del
%   roll base, que decide si el carro va derecho o invertido) y se le suma
%   el desvio pedido.
%
%   La direccion de la curvatura en el marco de transporte no depende del
%   roll, pero su modulo si (en los modos lo fija el coseno entre kappa y U),
%   asi que el roll se cierra con unas pocas pasadas de punto fijo. En el
%   acondicionamiento se pasa del roll de la ley base (el de entrada) al
%   alineado con el smoothstep quintico, que empalma C2 en los dos extremos.
%
%   phi' y phi'' que quedan en el Punto son aproximados: los de la ley base
%   mas los de la mezcla con el objetivo congelado. Sobre la polilinea ya
%   construida los completa GenerarGeometria (CompletarRollAlineado).
%   v es la del punto del riel, v_cm/J, con J sin el termino de phi'.

    Alinear = Contexto.PeralteHaciaLaFuerza;
    Parametros = Contexto.Parametros;
    g = Parametros.Gravedad;
    d = Parametros.DistanciaHeartline;

    Longitud = Alinear.LongitudTransicion;
    if Longitud > 0
        u = min(max((Punto.Arco - Alinear.ArcoInicio) / Longitud, 0), 1);
        Peso         = 6*u^5 - 15*u^4 + 10*u^3;
        DerivadaPeso = (30*u^4 - 60*u^3 + 30*u^2) / Longitud;
        SegundaPeso  = (120*u^3 - 180*u^2 + 60*u) / Longitud^2;
    else
        Peso = 1;
        DerivadaPeso = 0;
        SegundaPeso = 0;
    end

    Base  = Punto.AnguloRoll;
    BaseV = Punto.VelocidadRoll;
    BaseA = Punto.AceleracionRoll;
    Roll = Base;
    Objetivo = Base;
    for Iteracion = 1:4
        Punto = ConRoll(Punto, Roll, Contexto);
        [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(Punto);
        CurvaturaSobreU = CurvaturaArriba*cos(Roll) + CurvaturaLateral*sin(Roll);
        Velocidad = Punto.VelocidadCentroDeMasa / hypot(1 - d*CurvaturaSobreU, d*BaseV);
        FuerzaArriba  = Velocidad^2*CurvaturaArriba  + g*Punto.VersorArribaTransporte(3);
        FuerzaLateral = Velocidad^2*CurvaturaLateral + g*Punto.VersorLateralTransporte(3);
        if hypot(FuerzaArriba, FuerzaLateral) >= 0.05*g
            Objetivo = Base + AlEjeDeLaFuerza(atan2(FuerzaLateral, FuerzaArriba) - Base) + Alinear.Desvio;
        end
        RollNuevo = Base + Peso*(Objetivo - Base);
        if abs(RollNuevo - Roll) < 1e-12
            Roll = RollNuevo;
            break
        end
        Roll = RollNuevo;
    end
    Punto = ConRoll(Punto, Roll, Contexto);
    Punto.VelocidadRoll   = (1 - Peso)*BaseV + DerivadaPeso*(Objetivo - Base);
    Punto.AceleracionRoll = (1 - Peso)*BaseA - 2*DerivadaPeso*BaseV + SegundaPeso*(Objetivo - Base);
end

function Punto = ConRoll(Punto, Roll, Contexto)
    Punto.AnguloRoll = Roll;
    [Punto.VersorArribaCarro, Punto.VersorLateral] = MarcoCarroDesdeTransporte( ...
        Punto.VersorArribaTransporte, Punto.VersorLateralTransporte, Roll);
    if isfield(Contexto, 'FuncionAnguloDeCurvatura') && ~isempty(Contexto.FuncionAnguloDeCurvatura)
        Punto.AnguloCurvaturaDesdeArriba = Contexto.FuncionAnguloDeCurvatura(Punto) - Roll;
    else
        Punto.AnguloCurvaturaDesdeArriba = 0;
    end
end
