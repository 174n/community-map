import "regenerator-runtime/runtime";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet-boundary-canvas";
import Fuse from "fuse.js";
import slugify from "slugify";

const baseURL = process.env.NODE_ENV === "production" ? "" : "http://localhost:8080";

if ("{{googleAnalyticsId}}".length > 0) {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '{{googleAnalyticsId}}');
}

const icon = L.icon({
  iconUrl: require("../images/marker-icon.png"),
  iconRetinaUrl: require("../images/marker-icon-2x.png"),
  shadowUrl: require("../images/marker-shadow.png"),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
const grayIcon = L.icon({
  iconUrl: require("../images/marker-icon-gray.png"),
  iconRetinaUrl: require("../images/marker-icon-gray-2x.png"),
  shadowUrl: require("../images/marker-shadow.png"),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// map.on('click', function(e) {
//   console.log("Lat, Lon : " + e.latlng.lat + ", " + e.latlng.lng)
// });

const isUsernameHidden = u => u === "null" || u === "chatusername" || !u;
const parseUsername = u => isUsernameHidden(u) ? "<i>hidden</i>" : `<a href="https://t.me/${u}">@${u}</a>`;
const ifHidden = u => isUsernameHidden(u.username) ? `<br><i class="no-nickname">Для связи ему/ей нужно указать никнейм в телеге</i>` : "";

const loadMarkers = async country => {
  const apiURL = `records/${country.properties.ISO2.toLowerCase()}`;

  const markers = L.markerClusterGroup({
    maxClusterRadius: 50
  });

  const centerOnMarker = marker => {
    markers.zoomToShowLayer(marker, function() {
      marker.openPopup();
    })
  }

  const records = await (await fetch(`${baseURL}/${apiURL}`)).json();
  const data = records.map(r => {
    const marker = L.marker(new L.LatLng(r.lat, r.lng), { title: `${r.name} (${r.city})`, icon: isUsernameHidden(r.username) ? grayIcon: icon });
    const age = new Date().getFullYear() - new Date(r.birthdate).getFullYear();
    const ageString = `${age} ${age.toString().slice(-1) === '1' ? 'год' :
      ['2', '3', '4'].includes(age.toString().slice(-1)) ? 'года' : 'лет'}`;
    marker.bindPopup(`
      <div class="subtitle">
        <div class="avatar">
          <img src="${baseURL}/avatars/${r.id}.jpg" onerror="this.style.display='none'">
        </div>
        <div class="text">
          <div class="username">
            ${parseUsername(r.username)} (${r.name})
          </div>
          <div class="city">
            В городе <strong>${r.city}${ifHidden(r)}</strong>
          </div>
          <div class="age">
            ${r.birthdate ? ageString : ""}
          </div>
        </div>
      </div>
      ${r.description ? `<div class="description">${r.description}</div>` : ""}
    `);
    markers.addLayer(marker);
    r.latname = slugify(r.name, {replacement: ' '});
    return {...r, marker};
  });

  map.addLayer(markers);

  loadFuse(data, centerOnMarker);
}

const loadFuse = (data, centerOnMarker) => {
  const fuse = new Fuse(data, {
    keys: ['latname', 'username', 'city', 'description'],
    includeScore: true
  });

  const searchMarker = (w) => {
    return fuse.search(slugify(w, {replacement: ' '})).slice(0, 10).map(v => ({...v.item, open: () => centerOnMarker(v.item.marker)}))
  }

  const searchWrapper = document.querySelector(".search-wrapper");
  const search = document.querySelector(".search");
  const input = document.querySelector(".search .search-box");
  const results = document.querySelector(".search .results");
  const searchBtn = document.querySelector("#searchBtn");
  const searchClose = document.querySelector(".search .close");

  const inputUpdated = e => {
    const found = searchMarker(e?.target?.value || "a");
    results.innerHTML = "";
    found.forEach(f => {
      const el = document.createElement("div");
      el.classList.add("result");
      el.innerHTML = `<div class="title">${f.name}</div>
        <div class="subtitle">${f.username ? "@" + f.username : "<i>без юзернейма</i>"} из ${f.city}</div>
      </div>`;
      el.addEventListener("click", () => { searchWrapper.click(); f.open() });
      results.appendChild(el);
    });
  }

  inputUpdated();

  searchWrapper.addEventListener("click", e => {
    if (e.target === searchWrapper) {
      input.value = "";
      searchWrapper.classList.add("hide");
    }
  });

  searchClose.addEventListener("click", e => {
      input.value = "";
      searchWrapper.classList.add("hide");
  });

  searchBtn.addEventListener("click", e => {
    searchWrapper.classList.remove("hide");
    setTimeout(() => {
      input.focus();
    }, 300);
  });

  input.addEventListener("input", inputUpdated);
  
  document.addEventListener('keyup', e => {
    if (!searchWrapper.classList.contains("hide") && e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();
      searchWrapper.classList.add("hide");
      input.value = "";
    } else if (e.shiftKey && e.keyCode == 80) {
      e.preventDefault();
      e.stopPropagation();
      searchWrapper.classList.toggle("hide");
      if (!searchWrapper.classList.contains("hide")) {
        setTimeout(() => {
          input.focus();
        }, 300);
      } else {
        input.value = "";
      }
    }
  }, false);
}

const map = L.map("map");
const initMap = country => {
  map.eachLayer(function (layer) {
    map.removeLayer(layer);
  });
  if (countryBtn)
  countryBtn.innerHTML = country.properties.flag;
  const geoJSON = country;
  const osm = new L.TileLayer.BoundaryCanvas("https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=$$$$$$", {
    boundary: geoJSON,
    maxZoom: country.properties.maxZoom || 10,
    minZoom: country.properties.minZoom || 6,
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors | <a href="https://alexandrov.online">Разработчик</a>'
  });
  map.on('click', function (e) {
    var coord = e.latlng;
    var lat = coord.lat;
    var lng = coord.lng;
    console.log("You clicked the map at latitude: " + lat + " and longitude: " + lng);
  });
  map.addLayer(osm);
  const ukLayer = L.geoJSON(geoJSON);
  map.fitBounds(ukLayer.getBounds());
  
  loadMarkers(country);
}


const countryBtn = document.querySelector("#countryBtn");

const init = async () => {
  const countries = await (await fetch(`${baseURL}/countries`)).json();

  let currentCountry = location.host.split(".")[0].toLowerCase().indexOf(Object.keys(countries)) >= 0
    ? location.host.split(".")[0].toLowerCase()
    : Object.keys(countries)[0];
  
  countryBtn.addEventListener("click", () => {
    const i = Object.keys(countries).indexOf(currentCountry) + 1;
    currentCountry = Object.keys(countries)[i] || Object.keys(countries)[0];
    initMap(countries[currentCountry]);
  });

  if (Object.keys(countries).length === 1) {
    countryBtn.remove();
  }

  initMap(countries[currentCountry]);
}

init();


