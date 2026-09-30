function Receta = PeralteDelElemento(Receta, Parametros, ModoPropio, DesvioPropio, RollBaseFuerza)
%PERALTEDELELEMENTO Decide como se para el carro sobre la curva del elemento.
%   Receta.RollDelElemento llega con el peralte CONSTANTE del elemento (el
%   que declara cada uno: 0 en el loop, pi en el dive loop, el peralte en la
%   helice y el over-banked turn). Aca se lo reemplaza si el peralte se pide
%   referido al centro instantaneo de rotacion (CIR), que tiene dos
%   definiciones, las dos seleccionables:
%
%     'CentroDeCurvatura'  U apunta al centro de curvatura del riel: el
%                          angulo entre la curvatura y U es cero (psi = 0).
%                          Es un roll constante igual al desfasaje de la
%                          curvatura; en un giro a nivel es 90 grados.
%     'Fuerza'             U sigue a la fuerza especifica total (centripeta +
%                          gravedad) en el plano normal: es el peralte que
%                          anula Gy en el riel. Varia a lo largo del
%                          elemento; lo resuelve GenerarGeometria por punto
%                          fijo (CorreccionHaciaLaFuerza) sobre la base
%                          RollBaseFuerza: 0 para los giros (el carro arranca
%                          derecho) y el desfasaje para loop y dive loop.
%
%   Cualquier elemento puede pedir el peralte SIEMPRE alineado con una de las
%   dos (PeralteAlineadoAlCentroDeCurvatura, PeralteAlineadoALaFuerza,
%   excluyentes). Sin esos, el elemento usa su modo propio: 'Constante', o
%   'RelativoAlCentroDeCurvatura' / 'RelativoALaFuerza' con un desvio
%   constante respecto de esa referencia (DesvioPropio, ya con el signo del
%   sentido de giro). Solo el over-banked turn tiene modo propio; los demas
%   pasan 'Constante'.
%
%   Deja en la Receta AlineacionDelPeralte ('Constante', 'CentroDeCurvatura'
%   o 'Fuerza') y DesvioDelPeralte [rad].

    if Parametros.PeralteAlineadoAlCentroDeCurvatura && Parametros.PeralteAlineadoALaFuerza
        error('PeralteDelElemento:DosAlineaciones', ...
              ['PeralteAlineadoAlCentroDeCurvatura y PeralteAlineadoALaFuerza son excluyentes: ' ...
               'el peralte se alinea con una definicion del CIR o con la otra, no con las dos.']);
    end

    if Parametros.PeralteAlineadoAlCentroDeCurvatura
        Alineacion = 'CentroDeCurvatura';
        Desvio = 0;
    elseif Parametros.PeralteAlineadoALaFuerza
        Alineacion = 'Fuerza';
        Desvio = 0;
    else
        switch ModoPropio
            case 'Constante'
                Alineacion = 'Constante';
            case 'RelativoAlCentroDeCurvatura'
                Alineacion = 'CentroDeCurvatura';
            case 'RelativoALaFuerza'
                Alineacion = 'Fuerza';
            otherwise
                error('PeralteDelElemento:ModoDesconocido', ...
                      ['ModoDePeralteDelGiro tiene que ser ''Constante'', ''RelativoAlCentroDeCurvatura'' ' ...
                       'o ''RelativoALaFuerza'', no ''%s''.'], ModoPropio);
        end
        Desvio = DesvioPropio;
    end

    Receta.AlineacionDelPeralte = Alineacion;
    switch Alineacion
        case 'Constante'
            Receta.DesvioDelPeralte = 0;
        case 'CentroDeCurvatura'
            Receta.DesvioDelPeralte = Desvio;
            Receta.RollDelElemento  = Receta.DesfasajeDeCurvatura + Desvio;
        case 'Fuerza'
            Receta.DesvioDelPeralte = Desvio;
            Receta.RollDelElemento  = RollBaseFuerza;
    end
end
