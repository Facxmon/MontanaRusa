function [VersorArribaTransporte, VersorLateralTransporte] = MarcoTransporteDesdeCarro(VersorArribaCarro, VersorLateral, AnguloRoll)
%MARCOTRANSPORTEDESDECARRO Inversa de MarcoCarroDesdeTransporte.
%   Permite que el contrato de Estado guarde solo el marco del carro y el
%   angulo de roll, sin arrastrar tambien el marco de transporte.

    VersorArribaTransporte = cos(AnguloRoll).*VersorArribaCarro - sin(AnguloRoll).*VersorLateral;
    VersorLateralTransporte = sin(AnguloRoll).*VersorArribaCarro + cos(AnguloRoll).*VersorLateral;
end
