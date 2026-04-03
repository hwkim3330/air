// windCanvas.js — Animated wind particle layer for Leaflet

export class WindLayer {
    constructor(map, options = {}) {
        this.map = map;
        this.particleCount = options.particleCount || 3000;
        this.fadeOpacity = options.fadeOpacity || 0.96;
        this.speedFactor = options.speedFactor || 0.3;
        this.lineWidth = options.lineWidth || 1.2;
        this.particleMaxAge = options.particleMaxAge || 80;
        this.colorMode = options.colorMode || 'speed'; // 'speed' or 'white'

        this.windData = [];
        this.particles = [];
        this.canvas = null;
        this.ctx = null;
        this.animFrame = null;
        this.visible = true;
        this._gridCache = null;

        this._init();
    }

    _init() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'wind-canvas';
        this.map.getContainer().appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this._resize();
        window.addEventListener('resize', () => this._resize());
        this.map.on('move zoom moveend zoomend resize', () => {
            this._resize();
            this._resetParticles();
        });
    }

    _resize() {
        const container = this.map.getContainer();
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.canvas.style.width = container.clientWidth + 'px';
        this.canvas.style.height = container.clientHeight + 'px';
    }

    setData(windData) {
        this.windData = windData;
        this._buildGrid();
        this._resetParticles();
        if (!this.animFrame) this._animate();
    }

    _buildGrid() {
        if (!this.windData.length) return;

        // Find bounds
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const p of this.windData) {
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
            if (p.lng < minLng) minLng = p.lng;
            if (p.lng > maxLng) maxLng = p.lng;
        }

        // Detect grid dimensions
        const lats = [...new Set(this.windData.map(p => p.lat.toFixed(3)))].sort();
        const lngs = [...new Set(this.windData.map(p => p.lng.toFixed(3)))].sort();
        const rows = lats.length;
        const cols = lngs.length;

        // Build 2D grid
        const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
        for (const p of this.windData) {
            const r = Math.round(((p.lat - minLat) / (maxLat - minLat)) * (rows - 1));
            const c = Math.round(((p.lng - minLng) / (maxLng - minLng)) * (cols - 1));
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
                grid[r][c] = { u: p.u, v: p.v, speed: p.speed };
            }
        }

        // Fill nulls with nearest
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!grid[r][c]) {
                    grid[r][c] = { u: 0, v: 0, speed: 0 };
                }
            }
        }

        this._gridCache = { grid, rows, cols, minLat, maxLat, minLng, maxLng };
    }

    // Bilinear interpolation of wind at lat/lng
    _getWind(lat, lng) {
        if (!this._gridCache) return [0, 0, 0];
        const { grid, rows, cols, minLat, maxLat, minLng, maxLng } = this._gridCache;

        const r = ((lat - minLat) / (maxLat - minLat)) * (rows - 1);
        const c = ((lng - minLng) / (maxLng - minLng)) * (cols - 1);

        if (r < 0 || r >= rows - 1 || c < 0 || c >= cols - 1) return [0, 0, 0];

        const r0 = Math.floor(r), r1 = r0 + 1;
        const c0 = Math.floor(c), c1 = c0 + 1;
        const dr = r - r0, dc = c - c0;

        const g00 = grid[r0][c0], g01 = grid[r0][c1];
        const g10 = grid[r1][c0], g11 = grid[r1][c1];

        const u = (1 - dr) * ((1 - dc) * g00.u + dc * g01.u) + dr * ((1 - dc) * g10.u + dc * g11.u);
        const v = (1 - dr) * ((1 - dc) * g00.v + dc * g01.v) + dr * ((1 - dc) * g10.v + dc * g11.v);
        const speed = Math.sqrt(u * u + v * v);

        return [u, v, speed];
    }

    _resetParticles() {
        this.particles = [];
        const bounds = this.map.getBounds();
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(this._randomParticle(bounds));
        }
    }

    _randomParticle(bounds) {
        const b = bounds || this.map.getBounds();
        return {
            lat: b.getSouth() + Math.random() * (b.getNorth() - b.getSouth()),
            lng: b.getWest() + Math.random() * (b.getEast() - b.getWest()),
            age: Math.floor(Math.random() * this.particleMaxAge),
            maxAge: this.particleMaxAge + Math.floor(Math.random() * 20)
        };
    }

    _windSpeedColor(speed) {
        // Single cool tone — white/ice-blue. Speed = opacity + brightness.
        const alpha = Math.min(0.08 + speed * 0.06, 0.7);
        const bright = Math.min(180 + speed * 8, 245);
        return `rgba(${bright}, ${Math.min(bright + 10, 250)}, 255, ${alpha})`;
    }

    _animate() {
        if (!this.visible || !this._gridCache) {
            this.animFrame = requestAnimationFrame(() => this._animate());
            return;
        }

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const bounds = this.map.getBounds();

        // Fade previous frame
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeOpacity})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';

        ctx.lineWidth = this.lineWidth;

        for (const p of this.particles) {
            const [u, v, speed] = this._getWind(p.lat, p.lng);

            if (speed < 0.1) {
                p.age = p.maxAge; // kill stationary particles
            }

            // Previous position in pixels
            const pt0 = this.map.latLngToContainerPoint([p.lat, p.lng]);

            // Move particle
            const scaleFactor = this.speedFactor / Math.pow(2, this.map.getZoom() - 7);
            p.lng += u * scaleFactor * 0.01;
            p.lat += v * scaleFactor * 0.01;
            p.age++;

            // New position in pixels
            const pt1 = this.map.latLngToContainerPoint([p.lat, p.lng]);

            // Draw trail
            if (pt0.x >= -10 && pt0.x <= w + 10 && pt0.y >= -10 && pt0.y <= h + 10) {
                ctx.strokeStyle = this._windSpeedColor(speed);
                ctx.beginPath();
                ctx.moveTo(pt0.x, pt0.y);
                ctx.lineTo(pt1.x, pt1.y);
                ctx.stroke();
            }

            // Reset old/out-of-bounds particles
            if (p.age > p.maxAge ||
                p.lat < bounds.getSouth() || p.lat > bounds.getNorth() ||
                p.lng < bounds.getWest() || p.lng > bounds.getEast()) {
                const newP = this._randomParticle(bounds);
                p.lat = newP.lat;
                p.lng = newP.lng;
                p.age = 0;
                p.maxAge = newP.maxAge;
            }
        }

        this.animFrame = requestAnimationFrame(() => this._animate());
    }

    show() {
        this.visible = true;
        this.canvas.classList.remove('hidden');
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
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        this.canvas.remove();
    }
}
