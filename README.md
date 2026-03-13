# Webutvikling GIS Kartografi

Interaktivt Leaflet-kart med norske skoler, beredskaps- og samfunnsdata.

## Hva appen viser

- Tilfluktsrom (statisk GeoJSON)
- Politi, brannstasjoner og sykehus (fra Overpass, lagret som GeoJSON)
- Grunnskoler og videregaende skoler
- Sivilforsvarsdistrikter
- Kartverket WMS-lag (topo + terrengskygge)

## Funksjoner

- Lagkontroll (slå av/på lag)
- Klikk i kartet for radiusfilter
- Resultatpanel med funn innen radius
	- Tilfluktsrom
	- Beredskapsressurser (politi/brann/sykehus)
- Narmeste-ressurser panel
	- Narmeste tilfluktsrom (hvis Supabase RPC er tilgjengelig)
	- Narmeste beredskapsressurs (lokal GeoJSON)

## Datasett i prosjektet

I [data](data):

- [Offentlige_Tilfluktsrom.geojson](data/Offentlige_Tilfluktsrom.geojson)
- [Grunnskoler.geojson](data/Grunnskoler.geojson)
- [Videregaendeskoler.geojson](data/Videregaendeskoler.geojson)
- [Sivilforsvarsdistrikter.geojson](data/Sivilforsvarsdistrikter.geojson)
- [emergency_resources_police.geojson](data/emergency_resources_police.geojson)
- [emergency_resources_fire.geojson](data/emergency_resources_fire.geojson)
- [emergency_resources_hospital.geojson](data/emergency_resources_hospital.geojson)

## Viktige filer

- [index.html](index.html): HTML-struktur og paneler
- [style.css](style.css): styling
- [app.js](app.js): kartlogikk, lasting av lag, filtering og nearest-visning
- [scripts/overpass_data.py](scripts/overpass_data.py): henter politi/brann/sykehus fra Overpass

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

## Miljo og opprydding

Prosjektet bruker standardbibliotek i Python-scriptet (ingen ekstra pip-pakker kreves akkurat na).

[.gitignore](.gitignore) ignorerer virtuelle miljoer og Python-cache:

- .venv/
- .venv-1/
- __pycache__/
- *.pyc

