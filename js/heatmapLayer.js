// heatmapLayer.js — Air quality heatmap canvas overlay for Leaflet

export class HeatmapLayer {
    constructor(map) {
        this.map = map;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'heatmap-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.visible = true;
        this.stations = [];
        this.pollutant = 'aqi';

        map.getContainer().appendChild(this.canvas);
        this._resize();

        window.addEventListener('resize', () => this._resize());
        map.on('move zoom moveend zoomend resize', () => this.render());
    }

    _resize() {
        const container = this.map.getContainer();
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.canvas.style.width = container.clientWidth + 'px';
        this.canvas.style.height = container.clientHeight + 'px';
        this.render();
    }

    setData(stations, pollutant = 'aqi') {
        this.stations = stations;
        this.pollutant = pollutant;
        this.render();
    }

    _valueColor(val, pollutant) {
        let norm;
        switch (pollutant) {
            case 'pm25': norm = Math.min(val / 150, 1); break;
            case 'pm10': norm = Math.min(val / 300, 1); break;
            case 'o3':   norm = Math.min(val / 200, 1); break;
            case 'no2':  norm = Math.min(val / 100, 1); break;
            default:     norm = Math.min(val / 300, 1);
        }

        // 5-stop ramp: teal → lime → amber → rose → wine
        const stops = [
            [78, 205, 196],   // #4ECDC4 teal
            [167, 201, 87],   // #A7C957 lime
            [232, 168, 56],   // #E8A838 amber
            [217, 83, 79],    // #D9534F rose
            [107, 45, 79],    // #6B2D4F wine
        ];
        const t = norm * (stops.length - 1);
        const i = Math.min(Math.floor(t), stops.length - 2);
        const f = t - i;
        return [
            Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * f),
            Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * f),
            Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * f),
        ];
    }

    render() {
        if (!this.visible || !this.stations.length) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const zoom = this.map.getZoom();
        const baseRadius = Math.max(30, Math.min(150, 20 * Math.pow(2, zoom - 6)));

        for (const s of this.stations) {
            const pt = this.map.latLngToContainerPoint([s.lat, s.lng]);
            const val = s[this.pollutant] || s.aqi;
            const [r, g, b] = this._valueColor(val, this.pollutant);

            const gradient = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, baseRadius);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`);
            gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.12)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

            ctx.fillStyle = gradient;
            ctx.fillRect(pt.x - baseRadius, pt.y - baseRadius, baseRadius * 2, baseRadius * 2);
        }
    }

    show() {
        this.visible = true;
        this.canvas.classList.remove('hidden');
        this.render();
    }

    hide() {
        this.visible = false;
        this.canvas.classList.add('hidden');
    }

    toggle() {
        this.visible ? this.hide() : this.show();
        return this.visible;
    }

    destroy() {
        this.canvas.remove();
    }
}
