function Sim = ConEnergiaDelTren(Sim, Track, Tren)
%CONENERGIADELTREN Pone en el Sim del carro 1 la energia del TREN entero.
%   Con varios carros las columnas de energia del contrato son las del tren
%   (suma de los carros) en el instante en que el carro 1 esta en cada nodo:
%   es la cantidad que se conserva. La disipada arranca en 0 al entrar el
%   carro 1 al elemento, como el tiempo.

    Arco = Track.LongitudArco;
    Valido = ~isnan(Tren.VelocidadRielCuadrado);
    Conservar = Valido & [true; diff(Tren.Arco) > 1e-9];
    ArcoTren = Tren.Arco(Conservar);
    En = @(Valores) interp1(ArcoTren, Valores(Conservar), Arco, 'linear', NaN);

    Sim.EnergiaCinetica  = En(Tren.EnergiaCinetica);
    Sim.EnergiaPotencial = En(Tren.EnergiaPotencial);
    Sim.EnergiaTotal     = Sim.EnergiaCinetica + Sim.EnergiaPotencial;
    Rodadura = En(Tren.EnergiaDisipadaRodadura);
    Arrastre = En(Tren.EnergiaDisipadaArrastre);
    Sim.EnergiaDisipadaRodadura = Rodadura - Rodadura(1);
    Sim.EnergiaDisipadaArrastre = Arrastre - Arrastre(1);

    SinDato = isnan(Sim.VelocidadCentroDeMasa);
    Sim.EnergiaCinetica(SinDato)  = NaN;
    Sim.EnergiaPotencial(SinDato) = NaN;
    Sim.EnergiaTotal(SinDato)     = NaN;
    Sim.EnergiaDelTren = true;
end
