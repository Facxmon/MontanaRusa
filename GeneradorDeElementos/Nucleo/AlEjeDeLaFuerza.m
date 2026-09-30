function Angulo = AlEjeDeLaFuerza(Angulo)
%ALEJEDELAFUERZA Lleva un angulo a (-pi/2, pi/2]: alinear el EJE del carro
%   con la linea de la fuerza, no su sentido. Con -Gz la fuerza apunta hacia
%   abajo del carro, y alinearla no puede querer decir dar vuelta el carro.
    Angulo = mod(Angulo + pi/2, pi) - pi/2;
    if Angulo == -pi/2
        Angulo = pi/2;
    end
end
