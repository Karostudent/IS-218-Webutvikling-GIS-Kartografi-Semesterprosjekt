# IS-218 - Semesterprosjekt for Gruppe 2

# Webutvikling, GIS og kartografi – Analyse av skoleberedskap i Norge

## TLDR
Prosjektet analyserer geografisk beredskap for evakuering av skoleelever i Norge ved å kombinere interaktivt webkart, romlig database og GIS-analyse i notebook.  

Ved hjelp av data om offentlige tilfluktsrom, grunnskoler, videregående skoler og sivilforsvarsdistrikter undersøkes:

- avstand fra skoler til nærmeste tilfluktsrom  
- andel skoler innen 5 km dekning  
- variasjon i dekning mellom distrikter  
- kapasitet i tilfluktsrom sammenlignet med elevtall  
- geografiske områder med svak beredskap  

Webkartet gir dynamisk analyse via Supabase/PostGIS, mens notebooken dokumenterer en mer omfattende GIScience-analyse.

---

## Problemstilling

Hvordan varierer den geografiske beredskapen for evakuering av skoleelever mellom norske sivilforsvarsdistrikter, målt gjennom:

- avstand til nærmeste offentlige tilfluktsrom  
- andel skoler innen 5 km dekning  
- forholdet mellom elevtall og tilgjengelige tilfluktsromsplasser  
- identifikasjon av distrikter og områder med svak beredskap  

---

## Demo

Prosjektet består av to hovedkomponenter:

### Interaktivt webkart
Gir brukeren mulighet til å:

- slå av og på lag for skoler, tilfluktsrom, distrikter og beredskapsressurser  
- klikke i kartet og få dynamisk analyse fra database  
- visualisere nærmeste tilfluktsrom og objekter innen radius  
- se analyseresultater direkte i kartet  

### Notebook-analyse
Dokumenterer hele GIS-arbeidsflyten:

- reprojeksjon og datakontroll  
- avstandsanalyse  
- buffer og dekning  
- overlay  
- romlig aggregering per distrikt  
- distriktsranking  
- kapasitet vs elevanalyse  
- kart over svake områder  

![Demo av webkartet](docs/Demo.gif)

---

## Prosjektstruktur

```text
.
├── index.html
├── app.js
├── style.css
├── config.js
├── README.md
├── Notebook_Oppgave2.ipynb
├── data/
│   ├── Offentlige_Tilfluktsrom.geojson
│   ├── Grunnskoler.geojson
│   ├── Videregaendeskoler.geojson
│   ├── Sivilforsvarsdistrikter_ny.geojson
│   ├── emergency_resources_police.geojson
│   ├── emergency_resources_fire.geojson
│   └── emergency_resources_hospital.geojson
├── outputs/
│   ├── district_coverage_summary.csv
│   ├── dekning_kart.html
│   └── svake_omrader_kart.html

```

## Teknisk stack
| Teknologi | Rolle |
|-----------|------|
| Leaflet 1.9.x | interaktivt webkart |
| Supabase JS 2.x | klient mot database |
| PostGIS | romlige SQL-spørringer |
| GeoPandas | romlig analyse i notebook |
| Pandas | tabeller, oppsummering og eksport |
| Matplotlib | diagrammer og statiske kart |
| Folium | interaktiv kartvisualisering i notebook |
| GDAL | eksempel på rasteranalyse |
| GeoJSON | lokale geografiske datasett |
| Kartverket WMS | ekstern OGC-tjeneste for bakgrunnskart |



## Datasett

| Datasett | Kilde | Format | Bruk i prosjektet |
|---------|------|--------|-------------------|
| Offentlige tilfluktsrom | GeoNorge | GeoJSON + PostGIS | analysert i notebook, visualisert i webkart og brukt i spatial SQL |
| Grunnskoler | GeoNorge | GeoJSON | analysert i notebook og visualisert i webkart |
| Videregående skoler | GeoNorge | GeoJSON | analysert i notebook og visualisert i webkart |
| Sivilforsvarsdistrikter | GeoNorge | GeoJSON | brukt til romlig aggregering og polygonvisning |
| Beredskapsressurser | OpenStreetMap / Overpass | GeoJSON | visualisert i webkart som tilleggslag |

## Arkitektur
Prosjektet kombinerer tre nivåer:

### 1. Frontend (Leaflet)
 - visualisering av GeoJSON og WMS
 - layer control
 - popup og tooltip
 - klikkbasert analyse

### 2. Romlig database (Supabase/PostGIS)
Tilfluktsrom er lagret i tabellen shelters.
Kartet kaller SQL-funksjoner for å:

 - finne nærmeste tilfluktsrom
 - finne alle tilfluktsrom innen radius

Dette demonstrerer dynamisk spatial SQL i webapplikasjon.

### 3. GIS-analyse (Notebook)
Notebooken bruker GeoPandas, Pandas og Folium til å analysere:

 - avstand fra skoler til tilfluktsrom
 - bufferdekning
 - romlig overlay
 - distriktsvis dekning
 - ranking av distrikter
 - kapasitetsanalyse
 - kartlegging av svake områder

## Viktigste analyser
### Distriktsranking

Sivilforsvarsdistrikter rangeres etter:

 - andel skoler innen 5 km dekning
 - gjennomsnittlig avstand til tilfluktsrom

Dette synliggjør geografiske forskjeller i beredskap.

### Kapasitet vs elevtall

For hvert distrikt beregnes:

 - totalt elevtall
 - totale tilfluktsromsplasser
 - dekningsgrad (%)

Dette gir en indikasjon på hvor tilfluktsromkapasiteten er svakest.

### Kart over svake områder

Interaktive kart viser:

 - skoler uten dekning
 - distrikter med lav dekning

Dette gjør analysens funn visuelt tydelige.


# Oppgave 1 – Interaktivt webkart

## Mål

Målet i Oppgave 1 er å bygge et fungerende webkart som kombinerer statiske geografiske filer, ekstern karttjeneste og romlige analyser.

## Webkartet inkluderer:
 - Leaflet-basert kartvisning
 - statiske GeoJSON-lag for tilfluktsrom, grunnskoler, videregående skoler og sivilforsvarsdistrikter
 - ekstern WMS fra Kartverket
 - lagkontroll for å slå av og på datasett
 - popups og tooltips
 - datadrevet styling av punkter og polygoner
 - dynamisk analyse ved klikk i kartet
 - visning av nærmeste tilfluktsrom og øvrige objekter innen radius


## Brukerinteraksjon

Når brukeren klikker i kartet:
 - tegnes en analysesirkel med valgt radius
 - nærmeste tilfluktsrom beregnes via spatial SQL i Supabase/PostGIS
 - alle tilfluktsrom innen radius hentes ut
 - nærmeste beredskapsressurs markeres
 - resultater presenteres i egne informasjonsfelt

Dette gjør kartet til mer enn en ren visning; det fungerer også som et enkelt analyseverktøy.


# Oppgave 2 – GIScience og romlig analyse

## Del A: Notebook

Notebooken dokumenterer en GIS-basert analyse av skoleberedskap i Norge. Analysen bygger på fire sentrale datasett:
 - offentlige tilfluktsrom
 - grunnskoler
 - videregående skoler
 - sivilforsvarsdistrikter

Notebooken bruker GeoPandas, Pandas, Matplotlib og Folium til å gjennomføre og presentere analysene. Arbeidsflyten inkluderer:

 - innlesing og inspeksjon av flere geografiske datasett
 - reprojeksjon til et felles koordinatsystem i meter
 - beregning av avstand fra skoler til nærmeste offentlige tilfluktsrom
 - bufferanalyse med 5 km dekning rundt tilfluktsrom
 - overlayanalyse mellom skoler og buffersoner
 - romlig aggregering per sivilforsvarsdistrikt
 - eksport av resultattabell til CSV
 - statiske og interaktive kartvisualiseringer
 - dokumentasjon av en enkel rasterarbeidsflyt med GDAL

Hovedideen i analysen er å vurdere hvor godt norske skoler er geografisk dekket av offentlige tilfluktsrom, og hvordan dette varierer mellom distrikter.

## Del B: Utvidelse av webkart
Webkartet er utvidet med dynamiske romlige spørringer via Supabase og PostGIS. Når brukeren klikker i kartet, sendes koordinatene til SQL-funksjoner i databasen. Resultatet brukes til å:
 - finne nærmeste offentlige tilfluktsrom
 - finne alle offentlige tilfluktsrom innen valgt radius
 - vise avstand til nærmeste tilfluktsrom
 - framheve relevante objekter i kartet
 - vise oppsummerte resultater i informasjonsfelt


## SQL-snippet brukt i Supabase / PostGIS

```sql
-- Finn nærmeste tilfluktsrom
create or replace function api_nearest(lon double precision, lat double precision)
returns table (
  lokalid text,
  romnr integer,
  plasser integer,
  adresse text,
  objtype text,
  avstand_m double precision,
  lon_out double precision,
  lat_out double precision
)
language sql
as $$
  select
    lokalid,
    romnr,
    plasser,
    adresse,
    objtype,
    ST_Distance(
      geom::geography,
      ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
    ) as avstand_m,
    ST_X(geom) as lon_out,
    ST_Y(geom) as lat_out
  from shelters
  order by geom <-> ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  limit 1;
$$;

-- Finn alle tilfluktsrom innen radius
create or replace function api_within_radius(lon double precision, lat double precision, radius_m double precision)
returns table (
  lokalid text,
  romnr integer,
  plasser integer,
  adresse text,
  objtype text,
  lon_out double precision,
  lat_out double precision
)
language sql
as $$
  select
    lokalid,
    romnr,
    plasser,
    adresse,
    objtype,
    ST_X(geom) as lon_out,
    ST_Y(geom) as lat_out
  from shelters
  where ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    radius_m
  );
$$;
```

-- 
## Notebook-guide

Notebooken finnes i prosjektet som:
Notebook_Oppgave2.ipynb

Den dokumenterer en sammenhengende GIS-analyse av geografisk beredskap for evakuering av skoleelever i Norge. Arbeidsflyten kombinerer dataklargjøring, romlige analyser og visualisering av resultater.

Notebooken er strukturert slik:

1. introduksjon og problemstilling
2. import av biblioteker og innlesing av geografiske datasett
3. kontroll av datastruktur og koordinatsystem
4. reprojeksjon til et felles koordinatsystem i meter
5. innledende kartvisualisering av datasett
6. beregning av avstand fra skoler til nærmeste offentlige tilfluktsrom
7. bufferanalyse med 5 km dekning rundt tilfluktsrom
8. identifikasjon av skoler med og uten dekning
9. overlayanalyse mellom skoler og buffersoner
10. romlig aggregering og beregning av dekning per sivilforsvarsdistrikt
11. distriktsranking basert på dekning og gjennomsnittlig avstand
12. kapasitetsanalyse som sammenligner totalt elevtall med tilgjengelige 
13. tilfluktsromsplasser
14. kartvisualisering av områder og distrikter med svak beredskap
15. interaktive kart laget med Folium
16. dokumentasjon av en enkel rasterarbeidsflyt med GDAL
17. tolkning av resultater og refleksjon rundt begrensninger

Notebooken fungerer både som analyseverktøy og som dokumentasjon av metodisk arbeidsflyt i GIScience.


## Viktigste funn

Analysen viser klare geografiske forskjeller i beredskap for evakuering av skoleelever. Andelen skoler innen 5 km fra nærmeste offentlige tilfluktsrom varierer betydelig mellom sivilforsvarsdistriktene, og kartvisualiseringer identifiserer flere områder med svak dekning.

Distriktsranking og kapasitetsanalyse indikerer også at enkelte distrikter har et misforhold mellom elevtall og tilgjengelige tilfluktsromsplasser. Dette tyder på at beredskapen ikke bare påvirkes av avstand, men også av regional kapasitet og romlig fordeling av ressurser.

Samlet peker resultatene på at beredskapen for skoleevakuering varierer regionalt, og at enkelte distrikter kan framstå som mer sårbare enn andre.


## Begrensninger

Analysen har flere begrensninger:
 - den bruker luftlinjeavstand, ikke faktisk reisetid eller veinett
 - datasettet omfatter bare offentlige tilfluktsrom
 - analysen sier noe om geografisk nærhet, men ikke om kapasiteten er tilstrekkelig for alle elever
 - rasterdelen er dokumentert som arbeidsflyt, men ikke brukt som hovedgrunnlag for konklusjonene


## Kjøring lokalt

1. Klon prosjektet
git clone <repo-url>
cd <repo-mappe>

2. Kontroller konfigurasjon
Prosjektet bruker Supabase for de dynamiske romlige spørringene. Kontroller at config.js inneholder gyldig URL og nøkkel.
Eksempel:
window.APP_CONFIG = {
 SUPABASE_URL: "DIN_SUPABASE_URL",
 SUPABASE_ANON_KEY: "DIN_SUPABASE_ANON_KEY"
};

3. Start lokal server
Det holder å bruke en enkel lokal webserver, for eksempel:
npx live-server
eller:
python -m http.server 8080

4. Åpne kartet i nettleser
Åpne index.html via den lokale serveren.

5. Åpne notebooken
Start Jupyter og åpne:
jupyter notebook
Deretter åpner du Notebook_Oppgave2.ipynb.


## Resultatfiler
Notebooken genererer blant annet:
outputs/district_coverage_summary.csv
outputs/dekning_kart.html
Disse filene dokumenterer henholdsvis aggregert distriktsanalyse og interaktiv dekningvisualisering.


## Refleksjon
Prosjektet viser hvordan webutvikling, GIS og romlig database kan kombineres i én sammenhengende løsning. Webkartet gir en intuitiv inngang til datasettene, mens notebooken gir en mer eksplisitt og etterprøvbar analysearbeidsflyt.
En viktig styrke i prosjektet er at samme tema går igjen i både webkart og notebook: beredskap for skoleelever, avstand til tilfluktsrom og geografiske forskjeller mellom distrikter. Dette gir god faglig sammenheng mellom delene.
Samtidig finnes det klare begrensninger. Analysen er basert på luftlinjeavstand og offentlige tilfluktsrom, ikke faktisk transporttid, veinett eller samlet kapasitet opp mot elevtall. Resultatene bør derfor forstås som en forenklet indikator på geografisk beredskap, ikke som en fullstendig operativ vurdering.


## Videre arbeid
Aktuelle forbedringer i prosjektet kan være:
nettverksanalyse basert på veinett og reisetid
kapasitetsanalyse der antall elevplasser sammenlignes med antall tilgjengelige tilfluktsromsplasser
mer fullstendig rasteranalyse koblet til terreng og tilgjengelighet
tydeligere distriktsnavn og bedre etiketter i webkartet
filtrering og analyse direkte på skoleobjekter i kartet


## Leveranseoversikt
Prosjektet inneholder:
et Leaflet-basert webkart
lokale geografiske datasett i GeoJSON
dynamiske romlige spørringer via Supabase/PostGIS
en notebook med dokumentert romlig analyse
resultatfiler eksportert fra notebook
README med beskrivelse av datakilder, arkitektur, analyser og refleksjon