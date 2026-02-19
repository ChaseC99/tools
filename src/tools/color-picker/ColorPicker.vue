<template>
    <div class="picker-container">
        <div class="picker-main">
            <div class="spectrum-wrap">
                <canvas
                    ref="spectrumCanvas"
                    width="280"
                    height="280"
                    class="spectrum"
                    @mousedown="onSpectrumMouseDown"
                    @touchstart.prevent="onSpectrumTouchStart"
                ></canvas>
                <div
                    class="spectrum-cursor"
                    :style="{ left: cursorX + 'px', top: cursorY + 'px' }"
                ></div>
            </div>

            <input
                type="range"
                min="0"
                max="360"
                v-model.number="hue"
                class="hue-slider"
            />
        </div>

        <div class="swatch" :style="{ backgroundColor: hex }"></div>

        <div class="values">
            <div class="value-row">
                <label>HEX</label>
                <div class="input-with-copy">
                    <input
                        type="text"
                        :value="hex"
                        @input="onHexInput($event.target.value)"
                        spellcheck="false"
                        maxlength="7"
                    />
                    <button @click="copy(hex)" class="copy-btn">{{ copyLabel === 'hex' ? 'Copied!' : 'Copy' }}</button>
                </div>
            </div>
            <div class="value-row">
                <label>RGB</label>
                <div class="rgb-inputs">
                    <input type="number" min="0" max="255" v-model.number="r" />
                    <input type="number" min="0" max="255" v-model.number="g" />
                    <input type="number" min="0" max="255" v-model.number="b" />
                </div>
                <button @click="copy(`rgb(${r}, ${g}, ${b})`)" class="copy-btn">{{ copyLabel === 'rgb' ? 'Copied!' : 'Copy' }}</button>
            </div>
            <div class="value-row">
                <label>HSL</label>
                <div class="rgb-inputs">
                    <input type="number" min="0" max="360" v-model.number="hue" />
                    <input type="number" min="0" max="100" v-model.number="satPercent" />
                    <input type="number" min="0" max="100" v-model.number="lightPercent" />
                </div>
                <button @click="copy(`hsl(${hue}, ${satPercent}%, ${lightPercent}%)`)" class="copy-btn">{{ copyLabel === 'hsl' ? 'Copied!' : 'Copy' }}</button>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, watch, onMounted, nextTick } from 'vue';

export default {
    setup() {
        const spectrumCanvas = ref(null);
        const hue = ref(0);
        const sat = ref(1);
        const light = ref(0.5);
        const copyLabel = ref('');

        const cursorX = ref(280);
        const cursorY = ref(140);

        const r = ref(255);
        const g = ref(0);
        const b = ref(0);
        const hex = ref('#ff0000');
        const satPercent = ref(100);
        const lightPercent = ref(50);

        let updatingFrom = '';

        function hslToRgb(h, s, l) {
            h /= 360;
            let r2, g2, b2;
            if (s === 0) {
                r2 = g2 = b2 = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r2 = hue2rgb(p, q, h + 1/3);
                g2 = hue2rgb(p, q, h);
                b2 = hue2rgb(p, q, h - 1/3);
            }
            return [Math.round(r2 * 255), Math.round(g2 * 255), Math.round(b2 * 255)];
        }

        function rgbToHsl(r2, g2, b2) {
            r2 /= 255; g2 /= 255; b2 /= 255;
            const max = Math.max(r2, g2, b2), min = Math.min(r2, g2, b2);
            let h2 = 0, s2, l2 = (max + min) / 2;
            if (max === min) {
                s2 = 0;
            } else {
                const d = max - min;
                s2 = l2 > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r2: h2 = ((g2 - b2) / d + (g2 < b2 ? 6 : 0)) / 6; break;
                    case g2: h2 = ((b2 - r2) / d + 2) / 6; break;
                    case b2: h2 = ((r2 - g2) / d + 4) / 6; break;
                }
            }
            return [Math.round(h2 * 360), s2, l2];
        }

        function rgbToHex(r2, g2, b2) {
            return '#' + [r2, g2, b2].map(v => v.toString(16).padStart(2, '0')).join('');
        }

        function syncFromHsl() {
            const [r2, g2, b2] = hslToRgb(hue.value, sat.value, light.value);
            r.value = r2;
            g.value = g2;
            b.value = b2;
            hex.value = rgbToHex(r2, g2, b2);
            satPercent.value = Math.round(sat.value * 100);
            lightPercent.value = Math.round(light.value * 100);
            updateCursorFromSL();
            drawSpectrum();
        }

        function updateCursorFromSL() {
            cursorX.value = sat.value * 280;
            cursorY.value = (1 - light.value) * 280;
        }

        function drawSpectrum() {
            const canvas = spectrumCanvas.value;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            const imageData = ctx.createImageData(w, h);
            const data = imageData.data;

            for (let y = 0; y < h; y++) {
                const l = 1 - y / h;
                for (let x = 0; x < w; x++) {
                    const s = x / w;
                    const [cr, cg, cb] = hslToRgb(hue.value, s, l);
                    const i = (y * w + x) * 4;
                    data[i] = cr;
                    data[i + 1] = cg;
                    data[i + 2] = cb;
                    data[i + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
        }

        function onSpectrumMouseDown(e) {
            pickFromSpectrum(e);
            const onMove = (ev) => pickFromSpectrum(ev);
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        }

        function onSpectrumTouchStart(e) {
            pickFromSpectrumTouch(e);
            const onMove = (ev) => { ev.preventDefault(); pickFromSpectrumTouch(ev); };
            const onEnd = () => {
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onEnd);
            };
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onEnd);
        }

        function pickFromSpectrum(e) {
            const rect = spectrumCanvas.value.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            updatingFrom = 'spectrum';
            sat.value = x / rect.width;
            light.value = 1 - y / rect.height;
            cursorX.value = x;
            cursorY.value = y;
            syncFromHsl();
            nextTick(() => { updatingFrom = ''; });
        }

        function pickFromSpectrumTouch(e) {
            const touch = e.touches[0];
            const rect = spectrumCanvas.value.getBoundingClientRect();
            const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
            const y = Math.max(0, Math.min(touch.clientY - rect.top, rect.height));
            updatingFrom = 'spectrum';
            sat.value = x / rect.width;
            light.value = 1 - y / rect.height;
            cursorX.value = x;
            cursorY.value = y;
            syncFromHsl();
            nextTick(() => { updatingFrom = ''; });
        }

        function onHexInput(val) {
            let expanded = val;
            if (/^#[0-9a-fA-F]{3}$/.test(val)) {
                expanded = '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
            }
            if (/^#[0-9a-fA-F]{6}$/.test(expanded)) {
                updatingFrom = 'hex';
                const r2 = parseInt(expanded.slice(1, 3), 16);
                const g2 = parseInt(expanded.slice(3, 5), 16);
                const b2 = parseInt(expanded.slice(5, 7), 16);
                r.value = r2;
                g.value = g2;
                b.value = b2;
                const [h, s, l] = rgbToHsl(r2, g2, b2);
                hue.value = h;
                sat.value = s;
                light.value = l;
                hex.value = val;
                satPercent.value = Math.round(s * 100);
                lightPercent.value = Math.round(l * 100);
                updateCursorFromSL();
                drawSpectrum();
                nextTick(() => { updatingFrom = ''; });
            } else {
                hex.value = val;
            }
        }

        async function copy(text) {
            await navigator.clipboard.writeText(text);
            const label = text.startsWith('#') ? 'hex' : text.startsWith('rgb') ? 'rgb' : 'hsl';
            copyLabel.value = label;
            setTimeout(() => copyLabel.value = '', 1500);
        }

        watch(hue, () => {
            if (updatingFrom) return;
            syncFromHsl();
        });

        watch([r, g, b], () => {
            if (updatingFrom) return;
            updatingFrom = 'rgb';
            const [h, s, l] = rgbToHsl(r.value, g.value, b.value);
            hue.value = h;
            sat.value = s;
            light.value = l;
            hex.value = rgbToHex(r.value, g.value, b.value);
            satPercent.value = Math.round(s * 100);
            lightPercent.value = Math.round(l * 100);
            updateCursorFromSL();
            drawSpectrum();
            nextTick(() => { updatingFrom = ''; });
        });

        watch([satPercent, lightPercent], () => {
            if (updatingFrom) return;
            updatingFrom = 'hsl';
            sat.value = satPercent.value / 100;
            light.value = lightPercent.value / 100;
            syncFromHsl();
            nextTick(() => { updatingFrom = ''; });
        });

        onMounted(() => {
            nextTick(() => {
                syncFromHsl();
            });
        });

        return {
            spectrumCanvas, hue, r, g, b, hex, satPercent, lightPercent,
            cursorX, cursorY, copyLabel,
            onSpectrumMouseDown, onSpectrumTouchStart, onHexInput, copy,
        };
    }
};
</script>

<style scoped>
.picker-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 32px 20px;
}

.picker-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

.spectrum-wrap {
    position: relative;
    width: 280px;
    height: 280px;
    cursor: crosshair;
}

.spectrum {
    border-radius: 8px;
    display: block;
}

.spectrum-cursor {
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.3);
    transform: translate(-50%, -50%);
    pointer-events: none;
}

.hue-slider {
    width: 280px;
    height: 16px;
    -webkit-appearance: none;
    appearance: none;
    border-radius: 8px;
    background: linear-gradient(to right,
        hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
        hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%)
    );
    outline: none;
}

.hue-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #999;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.swatch {
    width: 120px;
    height: 60px;
    border-radius: 12px;
    border: 1px solid #ddd;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
}

.values {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 360px;
}

.value-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.value-row label {
    width: 36px;
    font-weight: bold;
    font-size: 13px;
    flex-shrink: 0;
}

.input-with-copy {
    display: flex;
    flex: 1;
    gap: 8px;
}

.input-with-copy input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-family: monospace;
    font-size: 14px;
}

.rgb-inputs {
    display: flex;
    gap: 4px;
    flex: 1;
}

.rgb-inputs input {
    width: 52px;
    padding: 6px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-family: monospace;
    font-size: 14px;
    text-align: center;
}

.copy-btn {
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
}

.copy-btn:hover {
    background: #f0f0f0;
}

@media (max-width: 600px) {
    .spectrum-wrap, .spectrum {
        width: 240px;
        height: 240px;
    }
    .hue-slider {
        width: 240px;
    }
}
</style>
