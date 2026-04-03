// app.js — Main application

import { generateDemoData, generateForecast, fetchOpenWeatherData, aqiColor, aqiLabel, STATIONS } from './dataService.js';
import { WindLayer } from './windCanvas.js';
import { HeatmapLayer } from './heatmapLayer.js';

// ─── State ────────────────────────────────────
let map, windLayer, heatmapLayer;
let stationMarkers = [];
let currentData = null;
let selectedStation = null;
let dataSource = 'demo';
let pollutant = 'pm25';
let apiKeys = { owm: '', airkorea: '' };

// ─── Init ─────────────────────────────────────
function init() {
    // Load saved API keys
    try {
        const saved = JSON.parse(localStorage.getItem('airmap-keys') || '{}');
        apiKeys = { ...apiKeys, ...saved };
        if (apiKeys.owm) document.getElementById('owm-key').value = apiKeys.owm;
        if (apiKeys.airkorea) document.getElementById('airkorea-key').value = apiKeys.airkorea;
    } catch (e) {}

    // Init map centered on Korea
    map = L.map('map', {
        center: [36.0, 127.5],
        zoom: 7,
        zoomControl: false,
        attributionControl: false
    });

    // Dark basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd'
    }).addTo(map);

    // Zoom control position
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Attribution
    L.control.attribution({ position: 'bottomright', prefix: false })
        .addAttribution('© <a href="https://carto.com/">CARTO</a> | © <a href="https://openstreetmap.org">OSM</a>')
        .addTo(map);

    // Init layers
    windLayer = new WindLayer(map, {
        particleCount: 2500,
        fadeOpacity: 0.95,
        speedFactor: 0.25,
        lineWidth: 1.0,
        particleMaxAge: 70
    });

    heatmapLayer = new HeatmapLayer(map);

    // Event listeners
    setupEvents();

    // Load initial data
    loadData();
}

// ─── Events ───────────────────────────────────
function setupEvents() {
    document.getElementById('data-source').addEventListener('change', (e) => {
        dataSource = e.target.value;
        if (dataSource !== 'demo' && !apiKeys.owm && !apiKeys.airkorea) {
            document.getElementById('api-modal').classList.remove('hidden');
        } else {
            loadData();
        }
    });

    document.getElementById('pollutant-select').addEventListener('change', (e) => {
        pollutant = e.target.value;
        if (currentData) {
            heatmapLayer.setData(currentData.stations, pollutant);
            updateStationMarkers(currentData.stations);
        }
    });

    document.getElementById('btn-wind').addEventListener('click', (e) => {
        const active = windLayer.toggle();
        e.target.classList.toggle('active', active);
    });

    document.getElementById('btn-heatmap').addEventListener('click', (e) => {
        const active = heatmapLayer.toggle();
        e.target.classList.toggle('active', active);
    });

    document.getElementById('btn-stations').addEventListener('click', (e) => {
        const show = e.target.classList.toggle('active');
        stationMarkers.forEach(m => show ? m.addTo(map) : m.remove());
    });

    document.getElementById('btn-refresh').addEventListener('click', () => loadData());

    document.getElementById('time-slider').addEventListener('input', (e) => {
        const hours = parseInt(e.target.value);
        if (hours === 0) {
            document.getElementById('time-label').textContent = '현재 실시간';
        } else {
            const future = new Date();
            future.setHours(future.getHours() + hours);
            const month = future.getMonth() + 1;
            const day = future.getDate();
            const hr = future.getHours();
            document.getElementById('time-label').textContent =
                `예측: ${month}/${day} ${hr}:00 (+${hours}시간)`;
        }

        if (dataSource === 'demo') {
            currentData = generateDemoData(hours);
            updateAll(currentData);
        }
    });

    // API key modal
    document.getElementById('save-keys').addEventListener('click', () => {
        apiKeys.owm = document.getElementById('owm-key').value.trim();
        apiKeys.airkorea = document.getElementById('airkorea-key').value.trim();
        localStorage.setItem('airmap-keys', JSON.stringify(apiKeys));
        document.getElementById('api-modal').classList.add('hidden');
        loadData();
    });

    document.getElementById('cancel-keys').addEventListener('click', () => {
        document.getElementById('api-modal').classList.add('hidden');
        document.getElementById('data-source').value = 'demo';
        dataSource = 'demo';
    });

    document.getElementById('close-panel').addEventListener('click', () => {
        document.getElementById('station-panel').classList.add('hidden');
        selectedStation = null;
    });
}

// ─── Data Loading ─────────────────────────────
async function loadData() {
    showLoading(true);

    try {
        if (dataSource === 'demo') {
            const hours = parseInt(document.getElementById('time-slider').value);
            currentData = generateDemoData(hours);
        } else if (dataSource === 'openweather' && apiKeys.owm) {
            currentData = await fetchOpenWeatherData(apiKeys.owm);
        } else {
            // Fallback to demo
            currentData = generateDemoData(0);
        }

        updateAll(currentData);
    } catch (e) {
        console.error('Failed to load data:', e);
        currentData = generateDemoData(0);
        updateAll(currentData);
    }

    showLoading(false);
}

function updateAll(data) {
    windLayer.setData(data.wind);
    heatmapLayer.setData(data.stations, pollutant);
    updateStationMarkers(data.stations);
}

// ─── Station Markers ──────────────────────────
function updateStationMarkers(stations) {
    stationMarkers.forEach(m => m.remove());
    stationMarkers = [];

    const showStations = document.getElementById('btn-stations').classList.contains('active');

    for (const s of stations) {
        const val = s[pollutant] || s.aqi;
        const color = pollutant === 'aqi' ? aqiColor(val) : getValueColor(val, pollutant);

        const marker = L.circleMarker([s.lat, s.lng], {
            radius: 6,
            fillColor: color,
            fillOpacity: 0.85,
            color: 'rgba(255,255,255,0.25)',
            weight: 1,
            opacity: 1
        });

        marker.bindPopup(createPopup(s), {
            maxWidth: 250,
            className: 'dark-popup'
        });

        marker.on('click', () => showStationPanel(s));

        if (showStations) marker.addTo(map);
        stationMarkers.push(marker);
    }
}

function getValueColor(val, type) {
    switch (type) {
        case 'pm25':
            if (val <= 15) return '#4ECDC4';
            if (val <= 35) return '#A7C957';
            if (val <= 75) return '#E8A838';
            return '#D9534F';
        case 'pm10':
            if (val <= 30) return '#4ECDC4';
            if (val <= 80) return '#A7C957';
            if (val <= 150) return '#E8A838';
            return '#D9534F';
        case 'o3':
            if (val <= 30) return '#4ECDC4';
            if (val <= 90) return '#A7C957';
            if (val <= 150) return '#E8A838';
            return '#D9534F';
        case 'no2':
            if (val <= 30) return '#4ECDC4';
            if (val <= 60) return '#A7C957';
            if (val <= 100) return '#E8A838';
            return '#D9534F';
        default:
            return aqiColor(val);
    }
}

function createPopup(s) {
    const color = aqiColor(s.aqi);
    const label = aqiLabel(s.aqi);
    return `
        <div class="popup-label">${s.name}</div>
        <div class="popup-aqi" style="color:${color}">${s.aqi}</div>
        <div style="color:${color}; font-weight:600; margin-bottom:6px">${label}</div>
        <div class="popup-row"><span>PM2.5</span><span>${s.pm25} µg/m³</span></div>
        <div class="popup-row"><span>PM10</span><span>${s.pm10} µg/m³</span></div>
        <div class="popup-row"><span>O₃</span><span>${s.o3} ppb</span></div>
        <div class="popup-row"><span>NO₂</span><span>${s.no2} ppb</span></div>
        <div class="popup-row"><span>CO</span><span>${s.co} ppm</span></div>
        <div class="popup-row"><span>SO₂</span><span>${s.so2} ppb</span></div>
    `;
}

// ─── Station Detail Panel ─────────────────────
function showStationPanel(station) {
    selectedStation = station;
    const panel = document.getElementById('station-panel');
    panel.classList.remove('hidden');

    document.getElementById('station-name').textContent = station.name;

    const badge = document.getElementById('station-aqi');
    badge.textContent = `AQI ${station.aqi} · ${aqiLabel(station.aqi)}`;
    badge.style.background = aqiColor(station.aqi);
    badge.style.color = station.aqi > 100 ? '#fff' : '#000';

    const details = document.getElementById('station-details');
    details.innerHTML = `
        <div class="detail-row"><span class="detail-label">PM2.5</span><span class="detail-value">${station.pm25} µg/m³</span></div>
        <div class="detail-row"><span class="detail-label">PM10</span><span class="detail-value">${station.pm10} µg/m³</span></div>
        <div class="detail-row"><span class="detail-label">오존 (O₃)</span><span class="detail-value">${station.o3} ppb</span></div>
        <div class="detail-row"><span class="detail-label">이산화질소 (NO₂)</span><span class="detail-value">${station.no2} ppb</span></div>
        <div class="detail-row"><span class="detail-label">일산화탄소 (CO)</span><span class="detail-value">${station.co} ppm</span></div>
        <div class="detail-row"><span class="detail-label">아황산가스 (SO₂)</span><span class="detail-value">${station.so2} ppb</span></div>
        <div class="detail-row"><span class="detail-label">지역</span><span class="detail-value">${station.region}</span></div>
    `;

    // Mini chart — 24h history (simulated)
    drawMiniChart(station);

    // Forecast bars
    drawForecastBars(station);
}

function drawMiniChart(station) {
    const canvas = document.getElementById('mini-chart');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Generate 24 hours of "historical" data
    const points = [];
    for (let hr = -23; hr <= 0; hr++) {
        const d = generateDemoData(hr);
        const s = d.stations.find(st => st.id === station.id);
        if (s) points.push({ hour: hr, value: s[pollutant] || s.aqi });
    }

    if (!points.length) return;

    const maxVal = Math.max(...points.map(p => p.value)) * 1.2;
    const minVal = 0;
    const padX = 30, padY = 10;
    const plotW = w - padX - 5;
    const plotH = h - padY * 2;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = padY + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(w - 5, y);
        ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const val = Math.round(maxVal - (maxVal / 4) * i);
        const y = padY + (plotH / 4) * i + 3;
        ctx.fillText(val, padX - 4, y);
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#4ECDC4';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    points.forEach((p, i) => {
        const x = padX + (i / (points.length - 1)) * plotW;
        const y = padY + plotH - ((p.value - minVal) / (maxVal - minVal)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under curve
    const lastPt = points[points.length - 1];
    const lastX = padX + plotW;
    const lastY = padY + plotH - ((lastPt.value - minVal) / (maxVal - minVal)) * plotH;
    ctx.lineTo(lastX, padY + plotH);
    ctx.lineTo(padX, padY + plotH);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padY, 0, padY + plotH);
    gradient.addColorStop(0, 'rgba(78, 205, 196, 0.12)');
    gradient.addColorStop(1, 'rgba(78, 205, 196, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // X-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('-24h', padX, h - 1);
    ctx.fillText('-12h', padX + plotW / 2, h - 1);
    ctx.fillText('현재', w - 5, h - 1);
}

function drawForecastBars(station) {
    const container = document.getElementById('forecast-bars');
    container.innerHTML = '';

    const forecast = generateForecast(station);
    const maxAqi = Math.max(...forecast.map(f => f.aqi), 1);

    forecast.forEach(f => {
        const bar = document.createElement('div');
        bar.className = 'forecast-bar';
        const height = Math.max(4, (f.aqi / maxAqi) * 56);
        bar.style.height = height + 'px';
        bar.style.background = aqiColor(f.aqi);

        const time = new Date(f.time);
        const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours()}시`;
        bar.setAttribute('data-tip', `${timeStr}: AQI ${f.aqi}`);

        container.appendChild(bar);
    });
}

// ─── Helpers ──────────────────────────────────
function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

// ─── Auto-refresh ─────────────────────────────
setInterval(() => {
    if (dataSource === 'demo') {
        const hours = parseInt(document.getElementById('time-slider').value);
        if (hours === 0) {
            // Refresh real-time demo data for smooth animation changes
            currentData = generateDemoData(0);
            // Only update wind, not re-render everything
            windLayer.setData(currentData.wind);
        }
    }
}, 60000); // every minute

// ─── Start ────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
