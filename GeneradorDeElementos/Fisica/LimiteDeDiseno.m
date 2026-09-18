function Limite = LimiteDeDiseno(Curva, Duracion, Semiancho)
%LIMITEDEDISENO Curva de la norma con las esquinas redondeadas por debajo.
%   Es el objetivo que persigue el modo GNormativaMaxima. La tabla de
%   LimiteNormativo es lineal por tramos, asi que su pendiente salta en
%   cada quiebre (en 1.0 s la Fig. 10 pasa de plana a -2 G/s). El modo
%   la usa como objetivo de Gz(t) y kappa(s) hereda cada quiebre como un
%   salto de dkappa/ds; con el roll helicoidal (phi'' = tan(alfa)*dkappa/ds)
%   eso es un escalon de Gy del orden de 0.01 G, y la politica de Gy exige
%   roll C2 (memoria de calculo, secciones 6.7 y 7.8). Aca se devuelve una
%   version C1 de la curva para DISENAR: en una ventana de +-Semiancho
%   alrededor de cada quiebre se le resta a la magnitud una correccion no
%   negativa que anula el salto de pendiente. El objetivo queda siempre por
%   debajo de la norma en modulo (nunca por encima), y la verificacion, que
%   sigue usando la tabla literal, no cambia. Con Semiancho = 0 es la tabla.
%
%   Correccion h en cada quiebre, con t medido desde el quiebre, w el
%   semiancho y Dm = pendiente derecha - pendiente izquierda de |limite|:
%     Dm < 0 (la pendiente baja, quiebre concavo):
%         h = (|Dm|/4) * (w - |t|)^2 / w         h' salta -|Dm|, h(0) = |Dm|*w/4
%     Dm > 0 (la pendiente sube, quiebre convexo):
%         h = (|Dm|/(2 w^2)) * (w - |t|)^2 * |t| h' salta +|Dm|, h max = 2|Dm|w/27
%   En los dos casos h >= 0, h(+-w) = 0 y h'(+-w) = 0, asi que |limite| - h
%   empalma C1 con la tabla fuera de la ventana. Los extremos de la tabla
%   cuentan como quiebres contra la extension constante. La ventana se
%   acota a la mitad del tramo mas corto que toca, para que dos quiebres
%   no se pisen.
%
%   Semiancho es Parametros.SemianchoDeSuavizadoNormativo, en segundos de
%   PROTOTIPO, igual que Duracion. Con 0.05 s el objetivo de la Fig. 10 baja
%   0.025 G en 1.0 s y 0.007 G en 2.0 s.

    [LimiteLiteral, Tabla] = LimiteNormativo(Curva, Duracion);
    if nargin < 3 || isempty(Semiancho) || Semiancho <= 0
        Limite = LimiteLiteral;
        return
    end

    Signo = sign(Tabla(1,2));
    if Signo == 0
        Signo = 1;
    end
    Tiempos    = Tabla(:,1);
    Magnitudes = abs(Tabla(:,2));

    % Pendientes de cada tramo, con la extension constante a los dos lados.
    Pendientes = [0; diff(Magnitudes) ./ diff(Tiempos); 0];
    Longitudes = [Inf; diff(Tiempos); Inf];

    Correccion = zeros(size(Duracion));
    for k = 1:numel(Tiempos)
        DeltaPendiente = Pendientes(k+1) - Pendientes(k);
        if abs(DeltaPendiente) < 1e-12
            continue
        end
        w = min([Semiancho, 0.5*Longitudes(k), 0.5*Longitudes(k+1)]);
        t = abs(Duracion - Tiempos(k));
        Dentro = t < w;
        if DeltaPendiente < 0
            h = (abs(DeltaPendiente)/4) * (w - t).^2 / w;
        else
            h = (abs(DeltaPendiente)/(2*w^2)) * (w - t).^2 .* t;
        end
        Correccion(Dentro) = Correccion(Dentro) + h(Dentro);
    end

    Limite = Signo * (abs(LimiteLiteral) - Correccion);
end
