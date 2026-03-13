if (window.__APP_LOADED__) {
  throw new Error("app.js lastet to ganger");
}
window.__APP_LOADED__ = true;

/******************************************************
 * KONFIGURASJON / KONSTANTER
 ******************************************************/

const SUPABASE_URL = "https://sfqeyhowtxlavjlxyxdg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcWV5aG93dHhsYXZqbHh5eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDUyNjcsImV4cCI6MjA4Mzg4MTI2N30.95lGAZRymlKdWKBadymEKyWZ6r-n_xIMHMepIXtgVMI";
const sbClient =
  (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const START_CENTER = [58.15, 8.0];   // Agder (Kristiansand)
const START_ZOOM = 11;
const RADIUS_METERS = 5000;          // Radius for filtrering


/******************************************************
 * KARTOPPSETT
 ******************************************************/

// Synkroniser radius-etikett i panelet med konstanten
const radiusLabelEl = document.getElementById("radiusLabel");
if (radiusLabelEl) radiusLabelEl.textContent = RADIUS_METERS.toLocaleString("nb-NO");

// 1️⃣ Opprett kart
const map = L.map("map").setView(START_CENTER, START_ZOOM);

// Basiskart (OpenStreetMap)
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

// Layer control
const baseLayers = { "OpenStreetMap": osm };
const overlays = {};
const layerControl = L.control.layers(baseLayers, overlays).addTo(map);

// Fjellskygge / hillshade (OGC WMS overlay)
const fjellskygge = L.tileLayer.wms("https://wms.geonorge.no/skwms1/wms.fjellskygge", {
  layers: "fjellskygge",
  format: "image/png",
  transparent: true,
  opacity: 0.35,          // juster 0.2–0.6 etter smak
  attribution: "Kartverket / GeoNorge"
});

// Legg i layer control (av/på)
layerControl.addOverlay(fjellskygge, "Terrengskygge (Fjellskygge WMS)");

// Valgfritt: slå på som default
fjellskygge.addTo(map);
fjellskygge.bringToFront();



// Eksternt OGC-lag (Kartverket WMS)
const kartverketWms = L.tileLayer.wms(
  "https://wms.geonorge.no/skwms1/wms.topo4",
  {
    layers: "topo4_WMS",
    format: "image/png",
    transparent: true,
    attribution: "Kartverket / GeoNorge"
  }
);

layerControl.addOverlay(kartverketWms, "Kartverket WMS (Topo4)");
kartverketWms.addTo(map);


/******************************************************
 * STYLING OG HJELPEFUNKSJONER
 ******************************************************/

// Kategoriser etter antall plasser
function categoryFromPlasser(plasser) {
  if (plasser < 100) return "Små";
  if (plasser <= 300) return "Middels";
  return "Store";
}

// Stil for alle tilfluktsrom (grå bakgrunnslag)
function styleAll() {
  return { radius: 4, color: "#666", fillColor: "#666", weight: 1, fillOpacity: 0.25 };
}

// Stil for filtrerte tilfluktsrom
function styleFromPlasser(plasser) {
  if (plasser < 100)
    return { radius: 5, color: "#2c7bb6", fillColor: "#2c7bb6", fillOpacity: 0.8 };
  if (plasser <= 300)
    return { radius: 7, color: "#fdae61", fillColor: "#fdae61", fillOpacity: 0.8 };
  return { radius: 9, color: "#d7191c", fillColor: "#d7191c", fillOpacity: 0.8 };
}

function emergencyLabel(type) {
  if (type === "police_station") return "Politi";
  if (type === "fire_station") return "Brannstasjon";
  if (type === "hospital") return "Sykehus";
  return "Beredskap";
}

function styleEmergency(type, isFiltered = false) {
  if (type === "police_station") {
    return {
      radius: isFiltered ? 8 : 6,
      color: "#1d4ed8",
      fillColor: "#3b82f6",
      weight: isFiltered ? 2 : 1,
      fillOpacity: 0.85
    };
  }
  if (type === "fire_station") {
    return {
      radius: isFiltered ? 8 : 6,
      color: "#b91c1c",
      fillColor: "#ef4444",
      weight: isFiltered ? 2 : 1,
      fillOpacity: 0.85
    };
  }
  if (type === "hospital") {
    return {
      radius: isFiltered ? 8 : 6,
      color: "#166534",
      fillColor: "#22c55e",
      weight: isFiltered ? 2 : 1,
      fillOpacity: 0.85
    };
  }
  return {
    radius: isFiltered ? 7 : 5,
    color: "#334155",
    fillColor: "#64748b",
    weight: isFiltered ? 2 : 1,
    fillOpacity: 0.8
  };
}

function nearestEmergencyFrom(latlng) {
  let best = null;
  for (const f of emergencyAllFeatures) {
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const pt = L.latLng(coords[1], coords[0]);
    const d = latlng.distanceTo(pt);
    if (!best || d < best.distanceMeters) {
      best = { feature: f, latlng: pt, distanceMeters: d };
    }
  }
  return best;
}

function nearestFeatureFrom(latlng, features) {
  let best = null;
  for (const f of features) {
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const pt = L.latLng(coords[1], coords[0]);
    const d = latlng.distanceTo(pt);
    if (!best || d < best.distanceMeters) {
      best = { feature: f, latlng: pt, distanceMeters: d };
    }
  }
  return best;
}


/******************************************************
 * GLOBALE VARIABLER
 ******************************************************/

let filterCircle = null;
let clickMarker = null;
let nearestMarker = null;
let nearestLine = null;
let nearestEmergencyMarker = null;
let nearestEmergencyLine = null;
let emergencyAllFeatures = [];
let primarySchoolFeatures = [];
let highSchoolFeatures = [];

// Filtrert lag fra DB (innen radius)
const filteredLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const plasser = Number(feature?.properties?.plasser);
    return L.circleMarker(latlng, styleFromPlasser(plasser));
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    layer.bindPopup(`
      <b>Tilfluktsrom (DB-resultat)</b><br>
      Adresse: ${p.adresse ?? "(mangler)"}<br>
      Plasser: ${p.plasser ?? "?"}<br>
      
    `);
  }
});
layerControl.addOverlay(filteredLayer, "Tilfluktsrom (innen radius) – DB");

const emergencyLayer_police_station = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const type = feature?.properties?.type;
    return L.circleMarker(latlng, styleEmergency(type, false));
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    layer.bindPopup(`
      <b>${emergencyLabel(p.type)}</b><br>
      Navn: ${p.name ?? "(mangler)"}<br>
      Kommune/by: ${p.municipality ?? "?"}<br>
      Telefon: ${p.phone ?? "?"}
    `);
  }
});
layerControl.addOverlay(emergencyLayer_police_station, "Beredskap (Politi)");

const emergencyLayer_hospital = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const type = feature?.properties?.type;
    return L.circleMarker(latlng, styleEmergency(type, false));
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    layer.bindPopup(`
      <b>${emergencyLabel(p.type)}</b><br>
      Navn: ${p.name ?? "(mangler)"}<br>
      Kommune/by: ${p.municipality ?? "?"}<br>
      Telefon: ${p.phone ?? "?"}
    `);
  }
});
layerControl.addOverlay(emergencyLayer_hospital, "Beredskap (Sykehus)");


const emergencyLayer_fire_station = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const type = feature?.properties?.type;
    return L.circleMarker(latlng, styleEmergency(type, false));
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    layer.bindPopup(`
      <b>${emergencyLabel(p.type)}</b><br>
      Navn: ${p.name ?? "(mangler)"}<br>
      Kommune/by: ${p.municipality ?? "?"}<br>
      Telefon: ${p.phone ?? "?"}
    `);
  }
});
layerControl.addOverlay(emergencyLayer_fire_station, "Beredskap (Brannstasjon)");

const emergencyFilteredLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const type = feature?.properties?.type;
    return L.circleMarker(latlng, styleEmergency(type, true));
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    layer.bindPopup(`
      <b>${emergencyLabel(p.type)} (innen radius)</b><br>
      Navn: ${p.name ?? "(mangler)"}<br>
      Kommune/by: ${p.municipality ?? "?"}<br>
      Telefon: ${p.phone ?? "?"}
    `);
  }
});
layerControl.addOverlay(emergencyFilteredLayer, "Beredskap (innen radius)");


/******************************************************
 * DATAFLYT:
 * 1) Hent GeoJSON (statisk fil)
 * 2) Tegn alle tilfluktsrom
 * 3) Ved klikk:
 *      - Filtrer innen radius
 *      - Finn nærmeste
 *      - Oppdater UI
 ******************************************************/

fetch("data/Offentlige_Tilfluktsrom.geojson")
  .then((r) => {
    if (!r.ok) throw new Error("HTTP error " + r.status);
    return r.json();
  })
  .then((data) => {
    // Vis alle tilfluktsrom (statiske) som et bakgrunnslag
    const allLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, styleAll()),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const kategori = categoryFromPlasser(Number(p.plasser));
        layer.bindPopup(`
          <b>Tilfluktsrom (${kategori})</b><br>
          Adresse: ${p.adresse ?? "(mangler)"}<br>
          Plasser: ${p.plasser ?? "?"}<br>
          
        `);
      }
    });

    allLayer.addTo(map);
    layerControl.addOverlay(allLayer, "Tilfluktsrom (GeoJSON – statisk)");
    map.fitBounds(allLayer.getBounds());

    console.log("Statisk GeoJSON lastet:", data.features?.length ?? 0);
  })
  .catch((err) => console.error("Feil ved lasting av GeoJSON:", err));

/******************************************************
 * GRUNNSKOLER
 ******************************************************/
fetch("data/Grunnskoler.geojson")
  .then((r) => { if (!r.ok) throw new Error("HTTP error " + r.status); return r.json(); })
  .then((data) => {
    primarySchoolFeatures = (data.features || []).filter((f) => {
  const c = f?.geometry?.coordinates;
  return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
});

    const grunnskoleLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, { radius: 5, color: "#1a7e40", fillColor: "#1a7e40", weight: 1, fillOpacity: 0.7 }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
          <b>Grunnskole</b><br>
          Navn: ${p.skolenavn ?? "(mangler)"}<br>
          Adresse: ${p.besoksadresse_adressenavn ?? "?"}, ${p.besoksadresse_poststed ?? ""}<br>
          Elever: ${p.antallelever ?? "?"} &nbsp;|&nbsp; Ansatte: ${p.antallansatte ?? "?"}<br>
          Eierforhold: ${p.eierforhold ?? "?"}
        `);
      }
    });
    layerControl.addOverlay(grunnskoleLayer, "Grunnskoler");
    console.log("Grunnskoler lastet:", data.features?.length ?? 0);
  })
  .catch((err) => console.error("Feil ved lasting av Grunnskoler:", err));

/******************************************************
 * VIDEREGÅENDE SKOLER
 ******************************************************/
fetch("data/Videregaendeskoler.geojson")
  .then((r) => { if (!r.ok) throw new Error("HTTP error " + r.status); return r.json(); })
  .then((data) => {
    highSchoolFeatures = (data.features || []).filter((f) => {
      const c = f?.geometry?.coordinates;
      return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
    });

    const vgsLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, { radius: 6, color: "#8e44ad", fillColor: "#8e44ad", weight: 1, fillOpacity: 0.7 }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
          <b>Videregående skole</b><br>
          Navn: ${p.skolenavn ?? "(mangler)"}<br>
          Adresse: ${p.besoksadresse_adressenavn ?? "?"}, ${p.besoksadresse_poststed ?? ""}<br>
          Elever: ${p.antallelever ?? "?"} &nbsp;|&nbsp; Ansatte: ${p.antallansatte ?? "?"}<br>
          Eierforhold: ${p.eierforhold ?? "?"}
        `);
      }
    });
    layerControl.addOverlay(vgsLayer, "Videregående skoler");
    console.log("Videregående skoler lastet:", data.features?.length ?? 0);
  })
  .catch((err) => console.error("Feil ved lasting av Videregaendeskoler:", err));

/******************************************************
 * SIVILFORSVARSDISTRIKTER
 ******************************************************/
fetch("data/Sivilforsvarsdistrikter.geojson")
  .then((r) => { if (!r.ok) throw new Error("HTTP error " + r.status); return r.json(); })
  .then((data) => {
    const sivilLayer = L.geoJSON(data, {
      style: () => ({ color: "#c0392b", weight: 2, fillColor: "#e74c3c", fillOpacity: 0.08 }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
          <b>Sivilforsvardistrikt</b><br>
          Type: ${p.objtype ?? "?"}<br>
          Grensekm: ${p.SHAPE_Length ? (p.SHAPE_Length / 1000).toFixed(1) + " km" : "?"}
        `);
      }
    });
    layerControl.addOverlay(sivilLayer, "Sivilforsvarsdistrikter");
    console.log("Sivilforsvarsdistrikter lastet:", data.features?.length ?? 0);
  })
  .catch((err) => console.error("Feil ved lasting av Sivilforsvarsdistrikter:", err));

/******************************************************
 * BEREDSKAPSRESSURSER (OVERPASS)
 ******************************************************/
Promise.all([
  fetch("data/emergency_resources_police.geojson").then((r) => {
    if (!r.ok) throw new Error("HTTP error " + r.status + " (police)");
    return r.json();
  }),
  fetch("data/emergency_resources_fire.geojson").then((r) => {
    if (!r.ok) throw new Error("HTTP error " + r.status + " (fire)");
    return r.json();
  }),
  fetch("data/emergency_resources_hospital.geojson").then((r) => {
    if (!r.ok) throw new Error("HTTP error " + r.status + " (hospital)");
    return r.json();
  })
])
  .then((datasets) => {
    const allFeatures = datasets.flatMap((d) => Array.isArray(d?.features) ? d.features : []);
    emergencyAllFeatures = allFeatures.filter((f) => {
      const c = f?.geometry?.coordinates;
      return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
    });

const policeFeatures = (datasets[0]?.features || []).filter((f) => {
  const c = f?.geometry?.coordinates;
  return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
});

const fireFeatures = (datasets[1]?.features || []).filter((f) => {
  const c = f?.geometry?.coordinates;
  return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
});

const hospitalFeatures = (datasets[2]?.features || []).filter((f) => {
  const c = f?.geometry?.coordinates;
  return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
});

emergencyAllFeatures = [...policeFeatures, ...fireFeatures, ...hospitalFeatures];

emergencyLayer_police_station.addData({
  type: "FeatureCollection",
  features: policeFeatures
}).addTo(map);

emergencyLayer_fire_station.addData({
  type: "FeatureCollection",
  features: fireFeatures
}).addTo(map);

emergencyLayer_hospital.addData({
  type: "FeatureCollection",
  features: hospitalFeatures
}).addTo(map);
    console.log("Beredskapsressurser lastet:", emergencyAllFeatures.length);
  })
  .catch((err) => console.error("Feil ved lasting av splitte emergency-filer:", err));

    /******************************************************
 * KLIKK: SPATIAL SQL VIA SUPABASE (radius + nearest)
 ******************************************************/
map.on("click", async (e) => {
  const lon = e.latlng.lng;
  const lat = e.latlng.lat;

  // Vis radius-sirkel
  if (filterCircle) map.removeLayer(filterCircle);
  filterCircle = L.circle(e.latlng, { radius: RADIUS_METERS }).addTo(map);

  // Marker klikkpunkt
  if (clickMarker) map.removeLayer(clickMarker);
  clickMarker = L.circleMarker(e.latlng, { radius: 6, weight: 2 }).addTo(map);

  // --- 0) Emergency resources: innen radius (lokal GeoJSON) ---
  const emergencyWithin = emergencyAllFeatures.filter((f) => {
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return false;
    const p = L.latLng(coords[1], coords[0]);
    return e.latlng.distanceTo(p) <= RADIUS_METERS;
  });

  emergencyFilteredLayer.clearLayers();
  emergencyFilteredLayer.addData({ type: "FeatureCollection", features: emergencyWithin }).addTo(map);

  // --- 0b) Narmeste emergency resource ---
  const nearestEmergency = nearestEmergencyFrom(e.latlng);
  if (nearestEmergencyMarker) map.removeLayer(nearestEmergencyMarker);
  if (nearestEmergencyLine) map.removeLayer(nearestEmergencyLine);
  if (nearestEmergency) {
    const emergencyType = nearestEmergency.feature?.properties?.type;
    nearestEmergencyMarker = L.circleMarker(nearestEmergency.latlng, styleEmergency(emergencyType, true)).addTo(map);
    nearestEmergencyLine = L.polyline([e.latlng, nearestEmergency.latlng], {
      weight: 2,
      dashArray: "6 6",
      color: styleEmergency(emergencyType, true).color
    }).addTo(map);
  }

  const nearestPrimarySchool = nearestFeatureFrom(e.latlng, primarySchoolFeatures);
const nearestHighSchool = nearestFeatureFrom(e.latlng, highSchoolFeatures);

  // --- A) DB: innen radius ---
  let withinFC = {
    type: "FeatureCollection",
    features: []
  };

  filteredLayer.clearLayers();
  if (sbClient) {
    const { data: withinRows, error: withinErr } = await sbClient.rpc("api_within_radius", {
      lon,
      lat,
      radius_m: RADIUS_METERS
    });

    if (withinErr) {
      console.error("api_within_radius error:", withinErr);
    } else {
      withinFC = {
        type: "FeatureCollection",
        features: (withinRows || []).map((r) => ({
          type: "Feature",
          properties: {
            lokalId: r.lokalid ?? r.lokalId,
            plasser: r.plasser,
            adresse: r.adresse,
            objtype: r.objtype
          },
          geometry: { type: "Point", coordinates: [r.lon_out, r.lat_out] }
        }))
      };
      filteredLayer.addData(withinFC).addTo(map);
    }
  } else {
    console.warn("Supabase ikke lastet – tilfluktsrom-filter fra DB er deaktivert.");
  }

  // Resultatliste (panel)
  const resultsDiv = document.getElementById("resultsList");
  if (resultsDiv) {
    if (withinFC.features.length === 0 && emergencyWithin.length === 0) {
      resultsDiv.innerHTML = `<i>Ingen funn innen ${RADIUS_METERS} m.</i>`;
    } else {
      const shelterItems = withinFC.features.map((f) => {
        const p = f.properties || {};
        return `<li><b>${p.adresse ?? "Ukjent adresse"}</b> — ${p.plasser ?? "?"} plasser (romnr ${p.romnr ?? "?"})</li>`;
      }).join("");

      const emergencyItems = emergencyWithin.map((f) => {
        const p = f.properties || {};
        const label = emergencyLabel(p.type);
        return `<li><b>${label}</b>: ${p.name ?? "Ukjent navn"}${p.municipality ? ` (${p.municipality})` : ""}</li>`;
      }).join("");

      const shelterSection = withinFC.features.length > 0
        ? `<b>Tilfluktsrom (${withinFC.features.length})</b><ul>${shelterItems}</ul>`
        : `<b>Tilfluktsrom</b><div><i>Ingen funn.</i></div>`;

      const emergencySection = emergencyWithin.length > 0
        ? `<b>Beredskap (politi, brann, sykehus) (${emergencyWithin.length})</b><ul>${emergencyItems}</ul>`
        : `<b>Beredskap (politi, brann, sykehus)</b><div><i>Ingen funn.</i></div>`;

      resultsDiv.innerHTML = `${shelterSection}<hr>${emergencySection}`;
    }
  }

  // --- B) DB: nærmeste tilfluktsrom ---
  let nearestShelter = null;
  if (sbClient) {
    const { data: nearestRows, error: nearestErr } = await sbClient.rpc("api_nearest", { lon, lat });

    if (nearestErr) {
      console.error("api_nearest error:", nearestErr);
    } else {
      nearestShelter = nearestRows?.[0] ?? null;
      if (nearestShelter) {
        const nearestLatLng = L.latLng(nearestShelter.lat_out, nearestShelter.lon_out);

        // Marker nærmeste + linje
        if (nearestMarker) map.removeLayer(nearestMarker);
        nearestMarker = L.circleMarker(nearestLatLng, { radius: 8, weight: 2 }).addTo(map);

        if (nearestLine) map.removeLayer(nearestLine);
        nearestLine = L.polyline([e.latlng, nearestLatLng], { weight: 3 }).addTo(map);
      }
    }
  }

  // Oppdater nearest panel (tilfluktsrom + emergency)
  const nearestText = document.getElementById("nearestText");
  if (nearestText) {

    const primaryschoolHtml = nearestPrimarySchool
  ? `
    <b>Nærmeste grunnskole</b><br>
    Avstand: <b>${Math.round(nearestPrimarySchool.distanceMeters / 1000)} km</b><br>
    Navn: <b>${nearestPrimarySchool.feature?.properties?.skolenavn ?? "(mangler)"}</b><br>
    Adresse: ${nearestPrimarySchool.feature?.properties?.besoksadresse_adressenavn ?? "?"}, ${nearestPrimarySchool.feature?.properties?.besoksadresse_poststed ?? ""}<br>
    Antall elever: ${nearestPrimarySchool.feature?.properties?.antallelever ?? "?"}<br>
    Antall ansatte: ${nearestPrimarySchool.feature?.properties?.antallansatte ?? "?"}
  `
      : `
        <b>Nærmeste grunnskole</b><br>
        <i>Ingen data (DB utilgjengelig eller ingen treff).</i>
      `;
      
      const highschoolHtml = nearestHighSchool
      ? `
        <b>Nærmeste videregående skole</b><br>
        Avstand: <b>${Math.round(nearestHighSchool.distanceMeters / 1000)} km</b><br>
        Navn: <b>${nearestHighSchool.feature?.properties?.skolenavn ?? "(mangler)"}</b><br>
        Adresse: ${nearestHighSchool.feature?.properties?.besoksadresse_adressenavn ?? "?"}, ${nearestHighSchool.feature?.properties?.besoksadresse_poststed ?? ""}<br>
        Antall elever: ${nearestHighSchool.feature?.properties?.antallelever ?? "?"}<br>
        Antall ansatte: ${nearestHighSchool.feature?.properties?.antallansatte ?? "?"}
      `
      : `
        <b>Nærmeste videregående skole</b><br>
        <i>Ingen data (DB utilgjengelig eller ingen treff).</i>
      `;


    const shelterHtml = nearestShelter
      ? `
        <b>Nærmeste tilfluktsrom</b><br>
        Avstand: <b>${Math.round(nearestShelter.avstand_m / 1000)} km</b><br>
        Adresse: <b>${nearestShelter.adresse ?? "(mangler)"}</b><br>
        Plasser: ${nearestShelter.plasser ?? "?"}<br>
        
      `
      : `
        <b>Nærmeste tilfluktsrom</b><br>
        <i>Ingen data (DB utilgjengelig eller ingen treff).</i>
      `;

    const emergencyHtml = nearestEmergency
      ? `
        <b>Nærmeste beredskap</b><br>
        Type: <b>${emergencyLabel(nearestEmergency.feature?.properties?.type)}</b><br>
        Avstand: <b>${Math.round(nearestEmergency.distanceMeters /1000)} km</b><br>
        Navn: ${nearestEmergency.feature?.properties?.name ?? "(mangler)"}
      `
      : `
        <b>Nærmeste beredskap</b><br>
        <i>Ingen beredskapsdata lastet.</i>
      `;

    nearestText.innerHTML = `${primaryschoolHtml}<hr>${highschoolHtml}<hr>${shelterHtml}<hr>${emergencyHtml}`;
  }
});
