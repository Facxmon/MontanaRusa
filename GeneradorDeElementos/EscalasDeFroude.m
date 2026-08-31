function Escala = EscalasDeFroude(Parametros)
%ESCALASDEFROUDE Factores de escala del modelo distorsionado.
%   lambda no es una propiedad del modelo: es una propiedad de un
%   emparejamiento entre una dimension del modelo y la del prototipo. Hay uno
%   por cada dimension y aca no se cablea ninguno.

    Escala.LambdaLoop  = Parametros.RadioLoopReal  / Parametros.RadioLoop;
    Escala.LambdaCarro = Parametros.LargoCarroReal / Parametros.LargoCarro;
    Escala.RaizLambdaLoop = sqrt(Escala.LambdaLoop);

    Escala.Distorsion = Escala.LambdaCarro / Escala.LambdaLoop;

    % Cuantos carros reales ocupan la misma fraccion de loop que el tren del
    % modelo. Es lambda_loop/lambda_carro, o sea 1/distorsion: un carro del
    % modelo mide L, y escalado por lambda_loop representa un largo
    % L*lambda_loop, que dividido por el carro real L*lambda_carro da esa
    % razon. (La consigna escribe NumeroDeCarros*distorsion, que sale
    % invertido respecto de la tabla de la memoria de calculo, seccion 9.6;
    % se usa la version de la memoria.)
    Escala.CarrosEquivalentes = Parametros.NumeroDeCarros / Escala.Distorsion;

    % Un modelo fiel a Froude produce jerk sqrt(lambda) veces MAYOR que el
    % prototipo. El criterio normativo aplica al prototipo, asi que el
    % presupuesto del modelo es mas alto que el numero de la norma.
    if isempty(Parametros.OnsetMaximoModelo)
        Escala.OnsetMaximo = Escala.RaizLambdaLoop * Parametros.OnsetNormativoPorEje;
    else
        Escala.OnsetMaximo = Parametros.OnsetMaximoModelo;
    end

    Escala.FactorLongitud   = 1 / Escala.LambdaLoop;
    Escala.FactorVelocidad  = 1 / Escala.RaizLambdaLoop;
    Escala.FactorTiempo     = 1 / Escala.RaizLambdaLoop;
    Escala.FactorAceleracion = 1;
    Escala.FactorJerk       = Escala.RaizLambdaLoop;
end
