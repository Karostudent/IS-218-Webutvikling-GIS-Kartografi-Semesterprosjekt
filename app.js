if (window.__APP_LOADED__) {
  throw new Error("app.js lastet to ganger");
}
window.__APP_LOADED__ = true;

/******************************************************
 * KONFIGURASJON / KONSTANTER
 ******************************************************/

const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY;

const sbClient =
  window.supabase &&
  typeof window.supabase.createClient === "function" &&
  SUPABASE_URL &&
  SUPABASE_ANON_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const START_CENTER = [64.5, 12.0];
const START_ZOOM = 5;
const RADIUS_METERS = 5000;

/******************************************************
 * KARTOPPSETT
 ******************************************************/

const radiusLabelEl = document.getElementById("radiusLabel");
if (radiusLabelEl) {
  radiusLabelEl.textContent = RADIUS_METERS.toLocaleString("nb-NO");
}

const map = L.map("map").setView(START_CENTER, START_ZOOM);

const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap"
}).addTo(map);

const baseLayers = { OpenStreetMap: osm };
const overlays = {};
const layerControl = L.control.layers(baseLayers, overlays).addTo(map);

const fjellskygge = L.tileLayer.wms("https://wms.geonorge.no/skwms1/wms.fjellskygge", {
  layers: "fjellskygge",
  format: "image/png",
  transparent: true,
  opacity: 0.55,
  attribution: "Kartverket / GeoNorge"
});
layerControl.addOverlay(fjellskygge, "Terrengskygge (Fjellskygge WMS)");
fjellskygge.addTo(map);
fjellskygge.bringToFront();

const kartverketWms = L.tileLayer.wms("https://wms.geonorge.no/skwms1/wms.topo4", {
  layers: "topo4_WMS",
  format: "image/png",
  transparent: true,
  attribution: "Kartverket / GeoNorge"
});
layerControl.addOverlay(kartverketWms, "Kartverket WMS (Topo4)");
kartverketWms.addTo(map);

/******************************************************
 * STYLING OG HJELPEFUNKSJONER
 ******************************************************/

function categoryFromPlasser(plasser) {
  const n = Number(plasser);
  if (!Number.isFinite(n)) return "Ukjent";
  if (n < 100) return "Små";
  if (n <= 300) return "Middels";
  return "Store";
}

function styleAll() {
  return { radius: 4, color: "#666", fillColor: "#666", weight: 1, fillOpacity: 0.25 };
}

function styleFromPlasser(plasser) {
  const n = Number(plasser);

  if (!Number.isFinite(n)) {
    return {
      radius: 5,
      color: "#475569",
      fillColor: "#94a3b8",
      weight: 1,
      fillOpacity: 0.8
    };
  }

  if (n < 100) {
    return {
      radius: 5,
      color: "#ca8a04",
      fillColor: "#fde047",
      weight: 1,
      fillOpacity: 0.9
    };
  }

  if (n <= 300) {
    return {
      radius: 7,
      color: "#b45309",
      fillColor: "#f59e0b",
      weight: 1,
      fillOpacity: 0.9
    };
  }

  return {
    radius: 9,
    color: "#78350f",
    fillColor: "#b45309",
    weight: 1,
    fillOpacity: 0.95
  };
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

function addTooltipAndHover(layer, tooltipText, growBy = 2) {
  const baseRadius = layer.options?.radius;

  if (tooltipText) {
    layer.bindTooltip(tooltipText, {
      direction: "top",
      offset: [0, -6],
      opacity: 0.95
    });
  }

  layer.on({
    mouseover: function () {
      if (typeof baseRadius === "number" && this.setStyle) {
        this.setStyle({ radius: baseRadius + growBy });
      }
    },
    mouseout: function () {
      if (typeof baseRadius === "number" && this.setStyle) {
        this.setStyle({ radius: baseRadius });
      }
    }
  });
}

function addLegendToLayerControl() {
  const controlContainer = document.querySelector(".leaflet-control-layers");
  if (!controlContainer) return;

  const oldLegend = controlContainer.querySelector(".layers-legend");
  if (oldLegend) oldLegend.remove();

  const legendHtml = `
    <div class="layers-legend">
      <div class="layers-legend-title">Tegnforklaring</div>

      <div class="legend-item">
        <span class="dot shelter-small"></span> Tilfluktsrom (små)
      </div>
      <div class="legend-item">
        <span class="dot shelter-medium"></span> Tilfluktsrom (middels)
      </div>
      <div class="legend-item">
        <span class="dot shelter-large"></span> Tilfluktsrom (store)
      </div>

      <hr>

      <div class="legend-item">
        <span class="dot police"></span> Politi
      </div>
      <div class="legend-item">
        <span class="dot fire"></span> Brannstasjon
      </div>
      <div class="legend-item">
        <span class="dot hospital"></span> Sykehus
      </div>

      <hr>

      <div class="legend-item">
        <span class="dot school"></span> Grunnskole
      </div>
      <div class="legend-item">
        <span class="dot vgs"></span> Videregående
      </div>

      <hr>

      <div class="legend-item">
        <span class="dot nearest"></span> Nærmeste tilfluktsrom
      </div>
      <div class="legend-item">
        <span class="line-symbol"></span> Avstandslinje
      </div>
      <div class="legend-item">
        <span class="circle-symbol"></span> Analyseområde (radius)
      </div>
    </div>
  `;

  controlContainer.insertAdjacentHTML("beforeend", legendHtml);
}

setTimeout(addLegendToLayerControl, 0);

/******************************************************
 * GLOBALE VARIABLER
 ******************************************************/

let grunnskoleLayer = null;
let vgsLayer = null;
let sivilLayer = null;

let filterCircle = null;
let clickMarker = null;
let nearestMarker = null;
let nearestLine = null;
let nearestEmergencyMarker = null;
let nearestEmergencyLine = null;

let emergencyAllFeatures = [];
let grunnskoleFeatures = [];
let vgsFeatures = [];

/******************************************************
 * RESULTATPANELER
 ******************************************************/

function updateResultPanels(
  withinFC,
  emergencyWithin,
  nearestPrimarySchool,
  nearestHighSchool,
  nearestShelter,
  nearestEmergency
) {
  const resultsDiv = document.getElementById("resultsList");

  if (resultsDiv) {
    if (withinFC.features.length === 0 && emergencyWithin.length === 0) {
      resultsDiv.innerHTML = `<i>Ingen funn innen ${RADIUS_METERS} m.</i>`;
    } else {
      const shelterItems = withinFC.features
        .map((f) => {
          const p = f.properties || {};
          return `<li><b>${p.adresse ?? "Ukjent adresse"}</b> — ${p.plasser ?? "?"} plasser (romnr ${p.romnr ?? "?"})</li>`;
        })
        .join("");

      const emergencyItems = emergencyWithin
        .map((f) => {
          const p = f.properties || {};
          return `<li><b>${emergencyLabel(p.type)}</b>: ${p.name ?? "Ukjent navn"}${p.municipality ? ` (${p.municipality})` : ""}</li>`;
        })
        .join("");

      const shelterSection =
        withinFC.features.length > 0
          ? `<b>Tilfluktsrom (${withinFC.features.length})</b><ul>${shelterItems}</ul>`
          : `<b>Tilfluktsrom</b><div><i>Ingen funn.</i></div>`;

      const emergencySection =
        emergencyWithin.length > 0
          ? `<b>Beredskap (politi, brann, sykehus) (${emergencyWithin.length})</b><ul>${emergencyItems}</ul>`
          : `<b>Beredskap (politi, brann, sykehus)</b><div><i>Ingen funn.</i></div>`;

      resultsDiv.innerHTML = `${shelterSection}<hr>${emergencySection}`;
    }
  }

  const nearestText = document.getElementById("nearestText");

  if (nearestText) {
    const grunnskoleHtml = nearestPrimarySchool
      ? `
        <b>Nærmeste grunnskole</b><br>
        Avstand: <b>${(nearestPrimarySchool.distanceMeters / 1000).toFixed(1)} km</b><br>
        Navn: <b>${nearestPrimarySchool.feature?.properties?.skolenavn ?? "(mangler)"}</b><br>
        Adresse: ${nearestPrimarySchool.feature?.properties?.besoksadresse_adressenavn ?? "?"}, ${nearestPrimarySchool.feature?.properties?.besoksadresse_poststed ?? ""}<br>
        Antall elever: ${nearestPrimarySchool.feature?.properties?.antallelever ?? "?"}<br>
        Antall ansatte: ${nearestPrimarySchool.feature?.properties?.antallansatte ?? "?"}
      `
      : `
        <b>Nærmeste grunnskole</b><br>
        <i>Ingen skoledata lastet eller ingen treff.</i>
      `;

    const vgsHtml = nearestHighSchool
      ? `
        <b>Nærmeste videregående skole</b><br>
        Avstand: <b>${(nearestHighSchool.distanceMeters / 1000).toFixed(1)} km</b><br>
        Navn: <b>${nearestHighSchool.feature?.properties?.skolenavn ?? "(mangler)"}</b><br>
        Adresse: ${nearestHighSchool.feature?.properties?.besoksadresse_adressenavn ?? "?"}, ${nearestHighSchool.feature?.properties?.besoksadresse_poststed ?? ""}<br>
        Antall elever: ${nearestHighSchool.feature?.properties?.antallelever ?? "?"}<br>
        Antall ansatte: ${nearestHighSchool.feature?.properties?.antallansatte ?? "?"}
      `
      : `
        <b>Nærmeste videregående skole</b><br>
        <i>Ingen skoledata lastet eller ingen treff.</i>
      `;

    const shelterHtml = nearestShelter
      ? `
        <b>Nærmeste tilfluktsrom</b><br>
        Avstand: <b>${(nearestShelter.avstand_m / 1000).toFixed(1)} km</b><br>
        Adresse: <b>${nearestShelter.adresse ?? "(mangler)"}</b><br>
        Plasser: ${nearestShelter.plasser ?? "?"}
      `
      : `
        <b>Nærmeste tilfluktsrom</b><br>
        <i>Ingen data fra database eller ingen treff.</i>
      `;

    const emergencyHtml = nearestEmergency
      ? `
        <b>Nærmeste beredskap</b><br>
        Type: <b>${emergencyLabel(nearestEmergency.feature?.properties?.type)}</b><br>
        Avstand: <b>${(nearestEmergency.distanceMeters / 1000).toFixed(1)} km</b><br>
        Navn: ${nearestEmergency.feature?.properties?.name ?? "(mangler)"}
      `
      : `
        <b>Nærmeste beredskap</b><br>
        <i>Ingen beredskapsdata lastet eller ingen treff.</i>
      `;

    nearestText.innerHTML = `${grunnskoleHtml}<hr>${vgsHtml}<hr>${shelterHtml}<hr>${emergencyHtml}`;
  }
}

/******************************************************
 * LAG
 ******************************************************/

const shelterDbFilteredLayer = L.geoJSON(null, {
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
      Romnr: ${p.romnr ?? "?"}
    `);

    addTooltipAndHover(
      layer,
      `${p.adresse ?? "Tilfluktsrom"} (${p.plasser ?? "?"} plasser)`
    );
  }
});
layerControl.addOverlay(shelterDbFilteredLayer, "Tilfluktsrom (innen radius) – DB");

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

    addTooltipAndHover(
      layer,
      `${emergencyLabel(p.type)}: ${p.name ?? "Ukjent navn"}`
    );
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

    addTooltipAndHover(
      layer,
      `${emergencyLabel(p.type)}: ${p.name ?? "Ukjent navn"}`
    );
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

    addTooltipAndHover(
      layer,
      `${emergencyLabel(p.type)}: ${p.name ?? "Ukjent navn"}`
    );
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

    addTooltipAndHover(
      layer,
      `${emergencyLabel(p.type)}: ${p.name ?? "Ukjent navn"}`
    );
  }
});
layerControl.addOverlay(emergencyFilteredLayer, "Beredskap (innen radius)");

/******************************************************
 * DATA: TILFLUKTSROM (STATISK)
 ******************************************************/

fetch("data/Offentlige_Tilfluktsrom.geojson")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP error ${r.status}`);
    return r.json();
  })
  .then((data) => {
    const allLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const plasser = Number(feature?.properties?.plasser);
        const baseStyle = styleFromPlasser(plasser);

        return L.circleMarker(latlng, {
          ...baseStyle,
          radius: Math.max((baseStyle.radius || 5) - 2, 3),
          fillOpacity: 0.35,
          weight: 1
        });
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const kategori = categoryFromPlasser(p.plasser);

        layer.bindPopup(`
          <b>Tilfluktsrom (${kategori})</b><br>
          Adresse: ${p.adresse ?? "(mangler)"}<br>
          Plasser: ${p.plasser ?? "?"}<br>
        `);

        addTooltipAndHover(
          layer,
          `${p.adresse ?? "Tilfluktsrom"} (${p.plasser ?? "?"} plasser)`
        );
      }
    });

    allLayer.addTo(map);
    layerControl.addOverlay(allLayer, "Tilfluktsrom (GeoJSON – statisk)");

    const bounds = allLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds);
    }

    console.log("Statisk GeoJSON lastet:", data.features?.length ?? 0);
  })
  .catch((err) => console.error("Feil ved lasting av GeoJSON:", err));

/******************************************************
 * DATA: GRUNNSKOLER
 ******************************************************/

fetch("data/Grunnskoler.geojson")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP error ${r.status}`);
    return r.json();
  })
  .then((data) => {
    grunnskoleFeatures = (data.features || []).filter((f) => {
      const c = f?.geometry?.coordinates;
      return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
    });

    grunnskoleLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 5,
          color: "#b308aa",
          fillColor: "#df68cf",
          weight: 1,
          fillOpacity: 0.7
        }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};

        layer.bindPopup(`
          <b>Grunnskole</b><br>
          Navn: ${p.skolenavn ?? "(mangler)"}<br>
          Adresse: ${p.besoksadresse_adressenavn ?? "?"}, ${p.besoksadresse_poststed ?? ""}<br>
          Elever: ${p.antallelever ?? "?"}
        `);

        addTooltipAndHover(layer, `${p.skolenavn ?? "Ukjent grunnskole"}`);

        layer.on("click", async (e) => {
          await runSpatialAnalysis(e.latlng);
        });
      }
    });

    grunnskoleLayer.addTo(map);
    layerControl.addOverlay(grunnskoleLayer, "Grunnskoler");
    console.log("Grunnskoler lastet:", data.features?.length ?? 0);
  })
  .catch((err) => console.error("Feil ved lasting av Grunnskoler:", err));

/******************************************************
 * DATA: VIDEREGÅENDE SKOLER
 ******************************************************/

fetch("data/Videregaendeskoler.geojson")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP error ${r.status}`);
    return r.json();
  })
  .then((data) => {
    vgsFeatures = (data.features || []).filter((f) => {
      const c = f?.geometry?.coordinates;
      return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
    });

    vgsLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 6,
          color: "#8e44ad",
          fillColor: "#8e44ad",
          weight: 1,
          fillOpacity: 0.7
        }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};

        layer.bindPopup(`
          <b>Videregående skole</b><br>
          Navn: ${p.skolenavn ?? "(mangler)"}<br>
          Adresse: ${p.besoksadresse_adressenavn ?? "?"}, ${p.besoksadresse_poststed ?? ""}<br>
          Elever: ${p.antallelever ?? "?"}
        `);

        addTooltipAndHover(layer, `${p.skolenavn ?? "Ukjent videregående skole"}`);

        layer.on("click", async (e) => {
          await runSpatialAnalysis(e.latlng);
        });
      }
    });

    vgsLayer.addTo(map);
    layerControl.addOverlay(vgsLayer, "Videregående skoler");
    console.log("Videregående skoler lastet:", data.features?.length ?? 0);
  })
  .catch((err) => console.error("Feil ved lasting av Videregaendeskoler:", err));

/******************************************************
 * DATA: SIVILFORSVARSDISTRIKTER
 ******************************************************/

fetch("data/Sivilforsvarsdistrikter_ny.geojson")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP error ${r.status}`);
    return r.json();
  })
  .then((data) => {
    sivilLayer = L.geoJSON(data, {
      style: () => ({
        color: "#c0392b",
        weight: 2,
        fillColor: "#e74c3c",
        fillOpacity: 0.08
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(`
          <b>Sivilforsvarsdistrikt</b><br>
          Navn: ${p.navn ?? "?"}<br>
        `);
      }
    });

    sivilLayer.addTo(map);
    layerControl.addOverlay(sivilLayer, "Sivilforsvarsdistrikter");
    console.log("Sivilforsvarsdistrikter lastet:", data.features?.length ?? 0);
  })
  .catch((err) => console.error("Feil ved lasting av Sivilforsvarsdistrikter:", err));

/******************************************************
 * DATA: BEREDSKAPSRESSURSER
 ******************************************************/

Promise.all([
  fetch("data/emergency_resources_police.geojson").then((r) => {
    if (!r.ok) throw new Error(`HTTP error ${r.status} (police)`);
    return r.json();
  }),
  fetch("data/emergency_resources_fire.geojson").then((r) => {
    if (!r.ok) throw new Error(`HTTP error ${r.status} (fire)`);
    return r.json();
  }),
  fetch("data/emergency_resources_hospital.geojson").then((r) => {
    if (!r.ok) throw new Error(`HTTP error ${r.status} (hospital)`);
    return r.json();
  })
])
  .then((datasets) => {
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
    });

    emergencyLayer_fire_station.addData({
      type: "FeatureCollection",
      features: fireFeatures
    });

    emergencyLayer_hospital.addData({
      type: "FeatureCollection",
      features: hospitalFeatures
    });

    console.log("Beredskapsressurser lastet:", emergencyAllFeatures.length);
  })
  .catch((err) => console.error("Feil ved lasting av splitte emergency-filer:", err));

/******************************************************
 * KLIKK: SPATIAL SQL VIA SUPABASE
 ******************************************************/

async function runSpatialAnalysis(latlng) {
  const lon = latlng.lng;
  const lat = latlng.lat;

  if (filterCircle) map.removeLayer(filterCircle);
  filterCircle = L.circle(latlng, { radius: RADIUS_METERS }).addTo(map);
  filterCircle.bringToBack();

  if (clickMarker) map.removeLayer(clickMarker);
  clickMarker = L.circleMarker(latlng, {
    radius: 6,
    weight: 2,
    color: "#111",
    fillColor: "#ffffff",
    fillOpacity: 0.95
  }).addTo(map);

  clickMarker.bindTooltip("Valgt punkt", {
    direction: "top",
    offset: [0, -6],
    opacity: 0.95
  });

  document.body.style.cursor = "wait";

  try {
    const emergencyWithin = emergencyAllFeatures.filter((f) => {
      const coords = f?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return false;

      const p = L.latLng(coords[1], coords[0]);
      return latlng.distanceTo(p) <= RADIUS_METERS;
    });

    emergencyFilteredLayer.clearLayers();
    emergencyFilteredLayer.addData({
      type: "FeatureCollection",
      features: emergencyWithin
    }).addTo(map);
    emergencyFilteredLayer.bringToFront();

    const nearestEmergency = nearestEmergencyFrom(latlng);

    if (nearestEmergencyMarker) map.removeLayer(nearestEmergencyMarker);
    if (nearestEmergencyLine) map.removeLayer(nearestEmergencyLine);

    nearestEmergencyMarker = null;
    nearestEmergencyLine = null;

    if (nearestEmergency) {
      const emergencyType = nearestEmergency.feature?.properties?.type;
      const emergencyName = nearestEmergency.feature?.properties?.name ?? "Ukjent navn";

      nearestEmergencyMarker = L.circleMarker(
        nearestEmergency.latlng,
        styleEmergency(emergencyType, true)
      ).addTo(map);

      nearestEmergencyMarker.bindPopup(`
        <b>Nærmeste beredskap</b><br>
        Type: ${emergencyLabel(emergencyType)}<br>
        Navn: ${emergencyName}<br>
        Avstand: ${(nearestEmergency.distanceMeters / 1000).toFixed(1)} km
      `);

      nearestEmergencyLine = L.polyline([latlng, nearestEmergency.latlng], {
        weight: 2,
        dashArray: "6 6",
        color: styleEmergency(emergencyType, true).color
      }).addTo(map);
    }

    const nearestGrunnskole = nearestFeatureFrom(latlng, grunnskoleFeatures);
    const nearestVgs = nearestFeatureFrom(latlng, vgsFeatures);

    let withinFC = {
      type: "FeatureCollection",
      features: []
    };

    let nearestShelter = null;

    shelterDbFilteredLayer.clearLayers();

    if (sbClient) {
      const { data: withinRows, error: withinErr } = await sbClient.rpc("api_within_radius", {
        lon,
        lat,
        radius_m: RADIUS_METERS
      });

      if (withinErr) {
        throw withinErr;
      }

      withinFC = {
        type: "FeatureCollection",
        features: (withinRows || []).map((r) => ({
          type: "Feature",
          properties: {
            lokalId: r.lokalid ?? r.lokalId,
            romnr: r.romnr,
            plasser: r.plasser,
            adresse: r.adresse,
            objtype: r.objtype
          },
          geometry: {
            type: "Point",
            coordinates: [r.lon_out, r.lat_out]
          }
        }))
      };

      shelterDbFilteredLayer.addData(withinFC).addTo(map);
      shelterDbFilteredLayer.bringToFront();

      const { data: nearestRows, error: nearestErr } = await sbClient.rpc("api_nearest", {
        lon,
        lat
      });

      if (nearestErr) {
        throw nearestErr;
      }

      nearestShelter = nearestRows?.[0] ?? null;
    } else {
      console.warn("Supabase ikke lastet – DB-analyse er deaktivert.");
    }

    if (nearestMarker) map.removeLayer(nearestMarker);
    if (nearestLine) map.removeLayer(nearestLine);

    nearestMarker = null;
    nearestLine = null;

    if (nearestShelter) {
      const nearestLatLng = L.latLng(nearestShelter.lat_out, nearestShelter.lon_out);

      nearestMarker = L.circleMarker(nearestLatLng, {
        radius: 8,
        weight: 2,
        color: "#111",
        fillColor: "#ffd54f",
        fillOpacity: 0.95
      }).addTo(map);

      nearestMarker.bindPopup(`
        <b>Nærmeste tilfluktsrom</b><br>
        Adresse: ${nearestShelter.adresse ?? "(mangler)"}<br>
        Plasser: ${nearestShelter.plasser ?? "?"}<br>
        Avstand: ${(nearestShelter.avstand_m / 1000).toFixed(1)} km
      `);

      nearestLine = L.polyline([latlng, nearestLatLng], {
        weight: 3,
        color: "#111",
        dashArray: "6 4"
      }).addTo(map);
    }

    updateResultPanels(
      withinFC,
      emergencyWithin,
      nearestGrunnskole,
      nearestVgs,
      nearestShelter,
      nearestEmergency
    );
  } catch (err) {
    console.error("Spatial analysis failed:", err);
    alert("Romlig analyse feilet. Sjekk Supabase-tilkobling eller SQL-funksjoner.");
  } finally {
    document.body.style.cursor = "default";
  }
}

map.on("click", async (e) => {
  await runSpatialAnalysis(e.latlng);
});