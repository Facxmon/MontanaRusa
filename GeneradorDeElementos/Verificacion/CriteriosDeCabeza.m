function Criterios = CriteriosDeCabeza(Sim, Parametros)
%CRITERIOSDECABEZA G en la cabeza, informativas.
%   La norma no se aplica en la cabeza, pero es la parte mas sensible a las
%   rotaciones y el disenador debe incluirlas (Rohde 2024, 7.6.2). Si
%   PuntoDeVerificacionNormativa es 'Cabeza' estas son las mismas que se
%   verifican.
    Criterios = CriteriosVacios();
    Valido = ~isnan(Sim.Velocidad);
    Criterios = AgregarCriterio(Criterios, 'Gz maxima en la cabeza', 'Informativo', ...
        max(Sim.GzCabeza(Valido)), NaN, 'G', ...
        sprintf('A %.3f m del riel (d + e). Las verificadas arriba estan a %.3f m.', ...
                Parametros.DistanciaHeartline + Parametros.DistanciaHeartlineACabeza, Sim.BrazoDeVerificacion));
    Criterios = AgregarCriterio(Criterios, '|Gy| maxima en la cabeza', 'Informativo', ...
        max(abs(Sim.GyCabeza(Valido))), NaN, 'G', '');
end
