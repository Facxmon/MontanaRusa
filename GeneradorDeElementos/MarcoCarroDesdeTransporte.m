function [VersorArribaCarro, VersorLateral] = MarcoCarroDesdeTransporte(VersorArribaTransporte, VersorLateralTransporte, AnguloRoll)
%MARCOCARRODESDETRANSPORTE Rota el marco de transporte paralelo por el roll.
%   El transporte paralelo da una referencia neutra sin giro propio; encima
%   de ella el roll es una funcion que el disenador escribe explicitamente.

    VersorArribaCarro =  cos(AnguloRoll).*VersorArribaTransporte + sin(AnguloRoll).*VersorLateralTransporte;
    VersorLateral     = -sin(AnguloRoll).*VersorArribaTransporte + cos(AnguloRoll).*VersorLateralTransporte;
end
