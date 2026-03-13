# TLDR - Webutvikling GIS Kartografi
Dette prosjektet analyserer evakueringsberedskapen rundt norske skoler ved å visualisere avstand til nærmeste tilfluktsrom og nødetatsressurser. Kartet kombinerer statiske GeoJSON-datasett, eksterne karttjenester og romlige databaseforespørsler (Spatial SQL). Målet er å demonstrere ferdigheter innen webkartografi, romlig analyse og geografiske databaser i et realistisk totalforsvarsscenario.

## Problemstilling
I en krisesituasjon kan det være nødvendig å evakuere skoleelever til sikre lokasjoner som offentlige tilfluktsrom. Samtidig vil effektiv evakuering være avhengig av geografisk tilgjengelighet til nødetater som kan koordinere innsatsen.

Dette prosjektet undersøker den geografiske beredskapsdekningen rundt skoler ved å analysere:

- Avstand til nærmeste tilfluktsrom
- Kapasitet i tilfluktsrom
- Tilgjengelighet til politi, brann og sykehus
- Samlet beredskapsstruktur innenfor en gitt radius


## Teknisk stack
- Leaflet (webkartbibliotek)
- Supabase + PostGIS (romlig database og Spatial SQL)
- GeoJSON (statiske datasett)
- OGC WMS fra Kartverket (bakgrunnslag)
- Overpass API (innhenting av nødetatsdata)
- JavaScript (analyse og visualisering)


## Datasett
- Offentlige tilfluktsrom – GeoNorge
- Grunnskoler – GeoNorge
- Videregående skoler – GeoNorge
- Sivilforsvarsdistrikter – GeoNorge
- Nødetater – OpenStreetMap (Overpass)


## Funksjoner
- Klikk i kartet for å utføre radiusanalyse
- Dynamisk Spatial SQL-spørring mot Supabase
- Visualisering av nærmeste tilfluktsrom
- Identifisering av nærmeste nødetatsressurs
- Visning av skoler og sivilforsvarsdistrikter
- Lagkontroll og datadrevet styling



## Arkitektur

- GeoJSON → Leaflet
- WMS → kartoverlay
- Kartklikk → Supabase RPC → PostGIS analyse
- Resultat → visualisering i kart og panel


## Begrensninger
- Analyse baserer seg på luftlinjeavstand
- Kapasitetsdata for tilfluktsrom er teoretiske
- Private tilfluktsrom er ikke inkludert
- Evakueringstid påvirkes av trafikk og organisering
- Datasettene er statiske øyeblikksbilder


## Kjoring lokalt

1. Start en enkel lokal server i prosjektroten.
2. Apne [index.html](index.html) via server-URL (ikke direkte file://).

Eksempel med Python:

```powershell
python -m http.server 8000
```

Deretter apner du http://localhost:8000/

## Oppdatere beredskapsdata (Overpass)

Kjor scriptet:

```powershell
python scripts/overpass_data.py
```

Output skrives til:

- [data/emergency_resources_police.geojson](data/emergency_resources_police.geojson)
- [data/emergency_resources_fire.geojson](data/emergency_resources_fire.geojson)
- [data/emergency_resources_hospital.geojson](data/emergency_resources_hospital.geojson)


