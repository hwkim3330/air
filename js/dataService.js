// dataService.js — Air quality + wind data fetching & demo data generation

// Korean air quality station data (major cities)
const STATIONS = [
    // Seoul metropolitan
    { id: 'seoul-jongno', name: '서울 종로구', lat: 37.572, lng: 126.979, region: '서울' },
    { id: 'seoul-gangnam', name: '서울 강남구', lat: 37.498, lng: 127.028, region: '서울' },
    { id: 'seoul-mapo', name: '서울 마포구', lat: 37.554, lng: 126.908, region: '서울' },
    { id: 'seoul-songpa', name: '서울 송파구', lat: 37.515, lng: 127.106, region: '서울' },
    { id: 'seoul-nowon', name: '서울 노원구', lat: 37.654, lng: 127.056, region: '서울' },
    { id: 'seoul-yangcheon', name: '서울 양천구', lat: 37.517, lng: 126.866, region: '서울' },
    // Gyeonggi
    { id: 'incheon', name: '인천 남동구', lat: 37.447, lng: 126.731, region: '인천' },
    { id: 'suwon', name: '수원 팔달구', lat: 37.286, lng: 127.002, region: '경기' },
    { id: 'seongnam', name: '성남 분당구', lat: 37.382, lng: 127.119, region: '경기' },
    { id: 'goyang', name: '고양 일산서구', lat: 37.677, lng: 126.770, region: '경기' },
    { id: 'yongin', name: '용인 수지구', lat: 37.322, lng: 127.098, region: '경기' },
    { id: 'paju', name: '파주시', lat: 37.759, lng: 126.780, region: '경기' },
    // Major cities
    { id: 'busan', name: '부산 해운대구', lat: 35.163, lng: 129.160, region: '부산' },
    { id: 'busan-saha', name: '부산 사하구', lat: 35.104, lng: 128.974, region: '부산' },
    { id: 'daegu', name: '대구 중구', lat: 35.871, lng: 128.601, region: '대구' },
    { id: 'daejeon', name: '대전 서구', lat: 36.355, lng: 127.384, region: '대전' },
    { id: 'gwangju', name: '광주 서구', lat: 35.152, lng: 126.890, region: '광주' },
    { id: 'ulsan', name: '울산 남구', lat: 35.544, lng: 129.330, region: '울산' },
    { id: 'sejong', name: '세종시', lat: 36.480, lng: 127.000, region: '세종' },
    // Regional
    { id: 'chuncheon', name: '춘천시', lat: 37.881, lng: 127.730, region: '강원' },
    { id: 'gangneung', name: '강릉시', lat: 37.752, lng: 128.896, region: '강원' },
    { id: 'wonju', name: '원주시', lat: 37.342, lng: 127.920, region: '강원' },
    { id: 'cheongju', name: '청주시', lat: 36.640, lng: 127.489, region: '충북' },
    { id: 'cheonan', name: '천안시', lat: 36.815, lng: 127.114, region: '충남' },
    { id: 'jeonju', name: '전주시', lat: 35.824, lng: 127.148, region: '전북' },
    { id: 'yeosu', name: '여수시', lat: 34.760, lng: 127.662, region: '전남' },
    { id: 'mokpo', name: '목포시', lat: 34.793, lng: 126.389, region: '전남' },
    { id: 'pohang', name: '포항시', lat: 36.019, lng: 129.343, region: '경북' },
    { id: 'gimhae', name: '김해시', lat: 35.228, lng: 128.889, region: '경남' },
    { id: 'changwon', name: '창원시', lat: 35.228, lng: 128.681, region: '경남' },
    { id: 'jeju', name: '제주시', lat: 33.500, lng: 126.531, region: '제주' },
    { id: 'seogwipo', name: '서귀포시', lat: 33.254, lng: 126.560, region: '제주' },
];

// Wind grid points covering Korea (lat 33-39, lng 124-131)
function generateWindGrid(rows = 15, cols = 18) {
    const points = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            points.push({
                lat: 33.0 + (r / (rows - 1)) * 6.0,
                lng: 124.0 + (c / (cols - 1)) * 7.0
            });
        }
    }
    return points;
}

// AQI color scale — desaturated tones for dark theme
export function aqiColor(aqi) {
    if (aqi <= 50) return '#4ECDC4';   // soft teal
    if (aqi <= 100) return '#A7C957';  // muted lime
    if (aqi <= 150) return '#E8A838';  // warm amber
    if (aqi <= 200) return '#D9534F';  // dusty rose-red
    if (aqi <= 300) return '#8E6BAD';  // muted amethyst
    return '#6B2D4F';                  // dark wine
}

export function aqiLabel(aqi) {
    if (aqi <= 50) return '좋음';
    if (aqi <= 100) return '보통';
    if (aqi <= 150) return '나쁨';
    if (aqi <= 200) return '매우나쁨';
    if (aqi <= 300) return '위험';
    return '심각';
}

// Wind speed color — single cool hue, intensity by speed
export function windColor(speed) {
    const alpha = Math.min(0.2 + speed * 0.06, 0.85);
    if (speed < 5) return `rgba(180, 210, 235, ${alpha})`;
    if (speed < 10) return `rgba(200, 225, 245, ${alpha})`;
    return `rgba(230, 240, 255, ${alpha})`;
}

// Generate realistic demo data
export function generateDemoData(hourOffset = 0) {
    const now = new Date();
    now.setHours(now.getHours() + hourOffset);
    const hour = now.getHours();

    // Base pollution pattern: higher in cities, morning/evening peaks
    const timeFactor = 1 + 0.3 * Math.sin((hour - 8) * Math.PI / 12); // peak at 8am, 8pm
    // Seasonal: spring in Korea = yellow dust possible
    const month = now.getMonth();
    const dustFactor = (month >= 2 && month <= 4) ? 1.3 : 1.0; // March-May

    // Prevailing wind: westerly to northwesterly (typical Korea)
    const baseWindDir = 290 + 30 * Math.sin(hourOffset * 0.1); // degrees
    const baseWindSpeed = 3 + 4 * Math.sin(hourOffset * 0.05 + 1);

    const stationData = STATIONS.map(s => {
        // Urban premium
        const urbanFactor = ['서울', '인천', '경기'].includes(s.region) ? 1.4 : 1.0;
        // Industrial areas
        const industrialFactor = ['울산', '부산'].includes(s.region) ? 1.2 : 1.0;
        // Coastal/clean areas
        const cleanFactor = ['제주', '강원'].includes(s.region) ? 0.6 : 1.0;

        const basePM25 = 18 + Math.random() * 20;
        const pm25 = Math.round(basePM25 * timeFactor * dustFactor * urbanFactor * industrialFactor * cleanFactor + (hourOffset * 0.5) * Math.sin(hourOffset));
        const pm10 = Math.round(pm25 * (1.8 + Math.random() * 0.5));
        const o3 = Math.round((20 + Math.random() * 40) * (hour >= 12 && hour <= 16 ? 1.5 : 0.8));
        const no2 = Math.round((15 + Math.random() * 30) * urbanFactor);
        const co = +(0.3 + Math.random() * 0.7).toFixed(1);
        const so2 = Math.round(3 + Math.random() * 10);

        // Calculate AQI from PM2.5 (simplified US EPA)
        let aqi;
        if (pm25 <= 12) aqi = Math.round(pm25 * 50 / 12);
        else if (pm25 <= 35.4) aqi = Math.round(50 + (pm25 - 12) * 50 / 23.4);
        else if (pm25 <= 55.4) aqi = Math.round(100 + (pm25 - 35.4) * 50 / 20);
        else if (pm25 <= 150.4) aqi = Math.round(150 + (pm25 - 55.4) * 50 / 95);
        else if (pm25 <= 250.4) aqi = Math.round(200 + (pm25 - 150.4) * 100 / 100);
        else aqi = Math.round(300 + (pm25 - 250.4) * 100 / 149.6);

        return {
            ...s,
            pm25: Math.max(1, pm25),
            pm10: Math.max(2, pm10),
            o3, no2, co, so2,
            aqi: Math.max(1, Math.min(500, aqi)),
            time: now.toISOString()
        };
    });

    // Wind field
    const windGrid = generateWindGrid();
    const windData = windGrid.map(p => {
        // Add spatial variation
        const latVar = Math.sin(p.lat * 2) * 15;
        const lngVar = Math.cos(p.lng * 1.5) * 10;
        const localDir = baseWindDir + latVar + lngVar + (Math.random() - 0.5) * 20;
        const localSpeed = Math.max(0.5, baseWindSpeed + Math.sin(p.lat + p.lng) * 2 + (Math.random() - 0.5) * 2);

        const dirRad = (localDir * Math.PI) / 180;
        return {
            lat: p.lat,
            lng: p.lng,
            u: -localSpeed * Math.sin(dirRad), // east component
            v: -localSpeed * Math.cos(dirRad), // north component
            speed: localSpeed,
            dir: localDir
        };
    });

    return { stations: stationData, wind: windData, time: now };
}

// Generate 48-hour forecast for a station
export function generateForecast(station) {
    const hours = [];
    for (let h = 0; h <= 48; h++) {
        const data = generateDemoData(h);
        const s = data.stations.find(st => st.id === station.id);
        if (s) {
            hours.push({
                hour: h,
                pm25: s.pm25,
                pm10: s.pm10,
                aqi: s.aqi,
                time: s.time
            });
        }
    }
    return hours;
}

// OpenWeatherMap API
export async function fetchOpenWeatherData(apiKey, lat = 36.5, lng = 127.5) {
    const bounds = { south: 33, north: 39, west: 124, east: 131 };
    const stations = [];
    const windPoints = [];

    // Fetch air quality for major cities
    const promises = STATIONS.map(async (s) => {
        try {
            const resp = await fetch(
                `https://api.openweathermap.org/data/2.5/air_pollution?lat=${s.lat}&lon=${s.lng}&appid=${apiKey}`
            );
            const data = await resp.json();
            if (data.list && data.list[0]) {
                const comp = data.list[0].components;
                const pm25 = comp.pm2_5;
                const pm10 = comp.pm10;
                let aqi;
                if (pm25 <= 12) aqi = Math.round(pm25 * 50 / 12);
                else if (pm25 <= 35.4) aqi = Math.round(50 + (pm25 - 12) * 50 / 23.4);
                else if (pm25 <= 55.4) aqi = Math.round(100 + (pm25 - 35.4) * 50 / 20);
                else aqi = Math.round(150 + (pm25 - 55.4) * 100 / 95);

                return {
                    ...s,
                    pm25: Math.round(pm25),
                    pm10: Math.round(pm10),
                    o3: Math.round(comp.o3 || 0),
                    no2: Math.round(comp.no2 || 0),
                    co: +((comp.co || 0) / 1000).toFixed(1),
                    so2: Math.round(comp.so2 || 0),
                    aqi: Math.max(1, Math.min(500, aqi)),
                    time: new Date().toISOString()
                };
            }
        } catch (e) {
            console.warn(`Failed to fetch air data for ${s.name}:`, e);
        }
        return null;
    });

    // Fetch wind data grid
    const windGrid = generateWindGrid(8, 10);
    const windPromises = windGrid.map(async (p) => {
        try {
            const resp = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lng}&appid=${apiKey}`
            );
            const data = await resp.json();
            if (data.wind) {
                const speed = data.wind.speed || 0;
                const deg = data.wind.deg || 0;
                const dirRad = (deg * Math.PI) / 180;
                return {
                    lat: p.lat,
                    lng: p.lng,
                    u: -speed * Math.sin(dirRad),
                    v: -speed * Math.cos(dirRad),
                    speed,
                    dir: deg
                };
            }
        } catch (e) {
            console.warn('Failed to fetch wind:', e);
        }
        return null;
    });

    const stationResults = await Promise.all(promises);
    const windResults = await Promise.all(windPromises);

    return {
        stations: stationResults.filter(Boolean),
        wind: windResults.filter(Boolean),
        time: new Date()
    };
}

// Export stations for external use
export { STATIONS };
