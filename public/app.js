const T = {
  Hospital:{ c:'#fb7185', i:'🏥', l:'Hospitals' },
  Clinic:{ c:'#22d3ee', i:'🩺', l:'Clinics' },
  Pharmacy:{ c:'#34d399', i:'💊', l:'Pharmacies' },
  'Medical Store':{ c:'#fbbf24', i:'🏪', l:'Medical Stores' },
};
const $ = id => document.getElementById(id);

const map = L.map('map', { zoomControl:false, maxZoom:19 }).setView([34.005, 72.925], 13);
L.control.zoom({ position:'topright' }).addTo(map);

// Basemap catalogue (all free, no API key needed)
const E = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const B = {
  Dark:{ g:'#1b2233,#3a4560', l:L.layerGroup([
    L.tileLayer(E+'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom:16, maxZoom:19, attribution:'Esri' }),
    L.tileLayer(E+'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom:16, maxZoom:19 })]) },
  Light:{ g:'#e5e7eb,#9ca3af', l:L.tileLayer(E+'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom:16, maxZoom:19, attribution:'Esri' }) },
  Streets:{ g:'#f6e7c1,#9fd3a8', l:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap' }) },
  Satellite:{ g:'#274229,#6b5a3c', l:L.tileLayer(E+'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19, attribution:'Esri' }) },
  Terrain:{ g:'#cfe3b4,#b08968', l:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom:17, attribution:'OpenTopoMap' }) },
};
let cur;
function setBase(n) {
  if (cur) map.removeLayer(B[cur].l);
  cur = n; B[n].l.addTo(map);
  document.querySelectorAll('.base').forEach(e => e.classList.toggle('on', e.dataset.n === n));
}
$('bases').innerHTML = Object.keys(B).map(n => `<div class="base" data-n="${n}" style="--g:${B[n].g}"><span></span>${n}</div>`).join('');
$('bases').onclick = e => { const el = e.target.closest('.base'); if (el) setBase(el.dataset.n); };
setBase('Dark');

let data, filter = 'All', q = '', markers = {};
const cluster = L.markerClusterGroup({ maxClusterRadius: 40 }).addTo(map);
const icon = t => L.divIcon({ className:'', iconSize:[34,34], html:`<div class="pin" style="--c:${T[t].c}">${T[t].i}</div>` });

const popup = (p, la, lo) => `<div style="--c:${T[p.type].c}">
  <div class="ph">${T[p.type].i} ${p.name}</div>
  <div class="pb"><b>Type:</b> ${p.type}<br><b>Ownership:</b> ${p.ownership}<br><b>Area:</b> ${p.area}
  ${p.phone ? '<br><b>Phone:</b> ' + p.phone : ''}${p.distance_km ? '<br><b>Distance:</b> ' + p.distance_km + ' km' : ''}
  <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${la},${lo}">Get Directions</a></div></div>`;

function render() {
  cluster.clearLayers(); markers = {};
  const fs = data.features.filter(f => (filter === 'All' || f.properties.type === filter) && f.properties.name.toLowerCase().includes(q));
  if (fs[0] && fs[0].properties.distance_km !== undefined) fs.sort((a, b) => a.properties.distance_km - b.properties.distance_km);
  fs.forEach(f => {
    const p = f.properties, [lo, la] = f.geometry.coordinates;
    markers[p.id] = L.marker([la, lo], { icon: icon(p.type) }).bindPopup(popup(p, la, lo), { maxWidth: 260 });
    cluster.addLayer(markers[p.id]);
  });
  $('list').innerHTML = fs.map(f => { const p = f.properties; return `<div class="row" data-id="${p.id}" style="--c:${T[p.type].c}">
    <span>${T[p.type].i}</span><div><b>${p.name}</b><small>${p.area}</small></div>${p.distance_km !== undefined ? `<em>${p.distance_km} km</em>` : ''}</div>`; }).join('');
}

function openFacility(id) { const m = markers[id]; if (m) cluster.zoomToShowLayer(m, () => m.openPopup()); }

function ui() {
  const types = Object.keys(T);
  $('stats').innerHTML = types.map(t => `<div class="st" style="--c:${T[t].c}"><b>${data.features.filter(f => f.properties.type === t).length}</b>${T[t].l}</div>`).join('');
  $('legend').innerHTML = '<h4>LEGEND</h4>' + types.map(t => `<div style="--c:${T[t].c}"><i></i>${T[t].i} ${t}</div>`).join('');
  $('chips').innerHTML = ['All', ...types].map(t => `<div class="chip ${t === 'All' ? 'on' : ''}" data-t="${t}" style="--c:${T[t] ? T[t].c : '#e6edf7'}">${t === 'All' ? 'All' : T[t].l}</div>`).join('');
}

$('chips').onclick = e => {
  const el = e.target.closest('.chip'); if (!el) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on'); filter = el.dataset.t; render();
};
$('search').oninput = e => { q = e.target.value.toLowerCase(); render(); };
$('list').onclick = e => { const el = e.target.closest('.row'); if (el) openFacility(el.dataset.id); };

// The frontend fetches the data from the API
fetch('/api/facilities').then(r => r.json()).then(d => {
  data = d; ui(); render(); map.fitBounds(cluster.getBounds().pad(0.1));
}).catch(() => { $('list').innerHTML = '<p class="about">Could not load the data. Please refresh the page.</p>'; });

// Nearest facility: browser location -> API (PostGIS distance) -> list sorted by distance
$('near').onclick = () => {
  if (!navigator.geolocation) { alert('Your browser does not support location services.'); return; }
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude } = pos.coords;
    data = await (await fetch(`/api/facilities?lat=${latitude}&lon=${longitude}`)).json();
    render();
    L.circleMarker([latitude, longitude], { radius:8, color:'#fff', fillColor:'#8b5cf6', fillOpacity:1 }).addTo(map).bindPopup('You are here');
    const first = $('list').firstElementChild;
    if (first) openFacility(first.dataset.id);
  }, () => alert('Location access is blocked. Please allow location in your browser settings and try again.'));
};