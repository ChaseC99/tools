import { clamp, cloneImageData } from "@tools/shared/imageUtils";

export type FilterId =
    | "grayscale"
    | "bw"
    | "sepia"
    | "invert"
    | "blur"
    | "vintage"
    | "pixelate"
    | "posterize"
    | "emboss"
    | "edge"
    | "vignette"
    | "glitch"
    | "duotone"
    | "solarize"
    | "noise";

export type FilterConfig = {
    id: FilterId;
    label: string;
    hasSlider: boolean;
    sliderMin: number;
    sliderMax: number;
    sliderDefault: number;
    sliderLabel?: string;
};

export const FILTERS: FilterConfig[] = [
    { id: "grayscale", label: "Grayscale", hasSlider: true, sliderMin: 0, sliderMax: 100, sliderDefault: 100, sliderLabel: "Intensity" },
    { id: "bw", label: "Black & White", hasSlider: true, sliderMin: 1, sliderMax: 255, sliderDefault: 128, sliderLabel: "Threshold" },
    { id: "sepia", label: "Sepia", hasSlider: true, sliderMin: 0, sliderMax: 100, sliderDefault: 100, sliderLabel: "Intensity" },
    { id: "invert", label: "Invert", hasSlider: false, sliderMin: 0, sliderMax: 100, sliderDefault: 100 },
    { id: "blur", label: "Blur", hasSlider: true, sliderMin: 1, sliderMax: 10, sliderDefault: 3, sliderLabel: "Radius" },
    { id: "vintage", label: "Vintage", hasSlider: true, sliderMin: 0, sliderMax: 100, sliderDefault: 70, sliderLabel: "Intensity" },
    { id: "pixelate", label: "Pixelate", hasSlider: true, sliderMin: 2, sliderMax: 40, sliderDefault: 8, sliderLabel: "Block Size" },
    { id: "posterize", label: "Posterize", hasSlider: true, sliderMin: 2, sliderMax: 16, sliderDefault: 4, sliderLabel: "Levels" },
    { id: "emboss", label: "Emboss", hasSlider: true, sliderMin: 1, sliderMax: 100, sliderDefault: 50, sliderLabel: "Strength" },
    { id: "edge", label: "Edge Detect", hasSlider: false, sliderMin: 0, sliderMax: 100, sliderDefault: 100 },
    { id: "vignette", label: "Vignette", hasSlider: true, sliderMin: 10, sliderMax: 100, sliderDefault: 50, sliderLabel: "Intensity" },
    { id: "glitch", label: "Glitch", hasSlider: true, sliderMin: 1, sliderMax: 50, sliderDefault: 15, sliderLabel: "Shift" },
    { id: "duotone", label: "Duotone", hasSlider: true, sliderMin: 0, sliderMax: 360, sliderDefault: 220, sliderLabel: "Hue" },
    { id: "solarize", label: "Solarize", hasSlider: true, sliderMin: 1, sliderMax: 255, sliderDefault: 128, sliderLabel: "Threshold" },
    { id: "noise", label: "Film Grain", hasSlider: true, sliderMin: 5, sliderMax: 100, sliderDefault: 30, sliderLabel: "Amount" },
];

function grayscale(d: Uint8ClampedArray, intensity: number) {
    const t = intensity / 100;
    for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i] + (gray - d[i]) * t;
        d[i + 1] = d[i + 1] + (gray - d[i + 1]) * t;
        d[i + 2] = d[i + 2] + (gray - d[i + 2]) * t;
    }
}

function blackAndWhite(d: Uint8ClampedArray, threshold: number) {
    for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const val = gray >= threshold ? 255 : 0;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
    }
}

function sepia(d: Uint8ClampedArray, intensity: number) {
    const t = intensity / 100;
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const sr = clamp(0.393 * r + 0.769 * g + 0.189 * b, 0, 255);
        const sg = clamp(0.349 * r + 0.686 * g + 0.168 * b, 0, 255);
        const sb = clamp(0.272 * r + 0.534 * g + 0.131 * b, 0, 255);
        d[i] = r + (sr - r) * t;
        d[i + 1] = g + (sg - g) * t;
        d[i + 2] = b + (sb - b) * t;
    }
}

function invert(d: Uint8ClampedArray) {
    for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
    }
}

function boxBlur(data: ImageData, radius: number) {
    const w = data.width;
    const h = data.height;
    const d = data.data;
    const copy = new Uint8ClampedArray(d);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let k = -radius; k <= radius; k++) {
                const nx = clamp(x + k, 0, w - 1);
                const idx = (y * w + nx) * 4;
                r += copy[idx];
                g += copy[idx + 1];
                b += copy[idx + 2];
                count++;
            }
            const idx = (y * w + x) * 4;
            d[idx] = r / count;
            d[idx + 1] = g / count;
            d[idx + 2] = b / count;
        }
    }

    const hPass = new Uint8ClampedArray(d);

    // Vertical pass
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let k = -radius; k <= radius; k++) {
                const ny = clamp(y + k, 0, h - 1);
                const idx = (ny * w + x) * 4;
                r += hPass[idx];
                g += hPass[idx + 1];
                b += hPass[idx + 2];
                count++;
            }
            const idx = (y * w + x) * 4;
            d[idx] = r / count;
            d[idx + 1] = g / count;
            d[idx + 2] = b / count;
        }
    }
}

function vintage(d: Uint8ClampedArray, intensity: number) {
    const t = intensity / 100;
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];

        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        let nr = gray + (r - gray) * (1 - 0.7 * t);
        let ng = gray + (g - gray) * (1 - 0.7 * t);
        let nb = gray + (b - gray) * (1 - 0.7 * t);

        nr = nr + (0.393 * r + 0.769 * g + 0.189 * b - nr) * 0.5 * t;
        ng = ng + (0.349 * r + 0.686 * g + 0.168 * b - ng) * 0.5 * t;
        nb = nb + (0.272 * r + 0.534 * g + 0.131 * b - nb) * 0.5 * t;

        const cFactor = 1 - 0.35 * t;
        nr = (nr - 128) * cFactor + 128;
        ng = (ng - 128) * cFactor + 128;
        nb = (nb - 128) * cFactor + 128;

        const lift = 30 * t;
        d[i] = clamp(nr + lift, 0, 255);
        d[i + 1] = clamp(ng + lift, 0, 255);
        d[i + 2] = clamp(nb + lift, 0, 255);
    }
}

function pixelate(data: ImageData, blockSize: number) {
    const w = data.width;
    const h = data.height;
    const d = data.data;

    for (let by = 0; by < h; by += blockSize) {
        for (let bx = 0; bx < w; bx += blockSize) {
            let r = 0, g = 0, b = 0, count = 0;
            const maxY = Math.min(by + blockSize, h);
            const maxX = Math.min(bx + blockSize, w);

            for (let y = by; y < maxY; y++) {
                for (let x = bx; x < maxX; x++) {
                    const idx = (y * w + x) * 4;
                    r += d[idx];
                    g += d[idx + 1];
                    b += d[idx + 2];
                    count++;
                }
            }

            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);

            for (let y = by; y < maxY; y++) {
                for (let x = bx; x < maxX; x++) {
                    const idx = (y * w + x) * 4;
                    d[idx] = r;
                    d[idx + 1] = g;
                    d[idx + 2] = b;
                }
            }
        }
    }
}

function posterize(d: Uint8ClampedArray, levels: number) {
    const step = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(Math.round(d[i] / step) * step);
        d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
        d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
    }
}

function emboss(data: ImageData, strength: number) {
    const w = data.width;
    const h = data.height;
    const d = data.data;
    const copy = new Uint8ClampedArray(d);
    const s = strength / 100;

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            const tlIdx = ((y - 1) * w + (x - 1)) * 4;
            const brIdx = ((y + 1) * w + (x + 1)) * 4;

            for (let c = 0; c < 3; c++) {
                const embossed = clamp(-copy[tlIdx + c] + copy[brIdx + c] + 128, 0, 255);
                d[idx + c] = clamp(copy[idx + c] + (embossed - copy[idx + c]) * s, 0, 255);
            }
        }
    }
}

function edgeDetect(data: ImageData) {
    const w = data.width;
    const h = data.height;
    const d = data.data;
    const copy = new Uint8ClampedArray(d);

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;

            for (let c = 0; c < 3; c++) {
                // Sobel X
                const gx =
                    -copy[((y - 1) * w + (x - 1)) * 4 + c] +
                    copy[((y - 1) * w + (x + 1)) * 4 + c] +
                    -2 * copy[(y * w + (x - 1)) * 4 + c] +
                    2 * copy[(y * w + (x + 1)) * 4 + c] +
                    -copy[((y + 1) * w + (x - 1)) * 4 + c] +
                    copy[((y + 1) * w + (x + 1)) * 4 + c];

                // Sobel Y
                const gy =
                    -copy[((y - 1) * w + (x - 1)) * 4 + c] +
                    -2 * copy[((y - 1) * w + x) * 4 + c] +
                    -copy[((y - 1) * w + (x + 1)) * 4 + c] +
                    copy[((y + 1) * w + (x - 1)) * 4 + c] +
                    2 * copy[((y + 1) * w + x) * 4 + c] +
                    copy[((y + 1) * w + (x + 1)) * 4 + c];

                d[idx + c] = clamp(Math.sqrt(gx * gx + gy * gy), 0, 255);
            }
        }
    }
}

function vignetteFilter(data: ImageData, intensity: number) {
    const w = data.width;
    const h = data.height;
    const d = data.data;
    const cx = w / 2;
    const cy = h / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    const t = intensity / 100;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
            const factor = 1 - dist * dist * t;
            const idx = (y * w + x) * 4;
            d[idx] = clamp(d[idx] * factor, 0, 255);
            d[idx + 1] = clamp(d[idx + 1] * factor, 0, 255);
            d[idx + 2] = clamp(d[idx + 2] * factor, 0, 255);
        }
    }
}

function glitch(data: ImageData, shift: number) {
    const w = data.width;
    const h = data.height;
    const d = data.data;
    const copy = new Uint8ClampedArray(d);

    // Seed a simple deterministic PRNG so thumbnails are consistent
    let seed = 12345;
    const rand = () => {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483646;
    };

    // Shift red channel right, blue channel left
    for (let y = 0; y < h; y++) {
        const rowShift = Math.round((rand() - 0.5) * 2 * shift);
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const srcR = clamp(x - rowShift, 0, w - 1);
            const srcB = clamp(x + rowShift, 0, w - 1);
            d[idx] = copy[(y * w + srcR) * 4];
            d[idx + 2] = copy[(y * w + srcB) * 4 + 2];
        }
    }

    // Random horizontal slice offsets
    const sliceCount = 5 + Math.floor(rand() * 10);
    for (let s = 0; s < sliceCount; s++) {
        const sliceY = Math.floor(rand() * h);
        const sliceH = 2 + Math.floor(rand() * 8);
        const sliceShift = Math.round((rand() - 0.5) * shift * 2);

        for (let y = sliceY; y < Math.min(sliceY + sliceH, h); y++) {
            for (let x = 0; x < w; x++) {
                const srcX = clamp(x - sliceShift, 0, w - 1);
                const dstIdx = (y * w + x) * 4;
                const srcIdx = (y * w + srcX) * 4;
                d[dstIdx] = copy[srcIdx];
                d[dstIdx + 1] = copy[srcIdx + 1];
                d[dstIdx + 2] = copy[srcIdx + 2];
            }
        }
    }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    let r: number, g: number, b: number;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function duotone(d: Uint8ClampedArray, hue: number) {
    // Dark color from hue, light color from hue + 40
    const [dr, dg, db] = hslToRgb(hue, 0.8, 0.2);
    const [lr, lg, lb] = hslToRgb((hue + 40) % 360, 0.6, 0.85);

    for (let i = 0; i < d.length; i += 4) {
        const gray = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        d[i] = clamp(dr + (lr - dr) * gray, 0, 255);
        d[i + 1] = clamp(dg + (lg - dg) * gray, 0, 255);
        d[i + 2] = clamp(db + (lb - db) * gray, 0, 255);
    }
}

function solarize(d: Uint8ClampedArray, threshold: number) {
    for (let i = 0; i < d.length; i += 4) {
        if (d[i] > threshold) d[i] = 255 - d[i];
        if (d[i + 1] > threshold) d[i + 1] = 255 - d[i + 1];
        if (d[i + 2] > threshold) d[i + 2] = 255 - d[i + 2];
    }
}

function noise(d: Uint8ClampedArray, amount: number) {
    // Deterministic PRNG for consistent thumbnails
    let seed = 54321;
    const rand = () => {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < d.length; i += 4) {
        const n = (rand() - 0.5) * amount * 2.55;
        d[i] = clamp(d[i] + n, 0, 255);
        d[i + 1] = clamp(d[i + 1] + n, 0, 255);
        d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
}

export function applyFilter(source: ImageData, filterId: FilterId, value: number): ImageData {
    const result = cloneImageData(source);
    const d = result.data;

    switch (filterId) {
        case "grayscale":
            grayscale(d, value);
            break;
        case "bw":
            blackAndWhite(d, value);
            break;
        case "sepia":
            sepia(d, value);
            break;
        case "invert":
            invert(d);
            break;
        case "blur":
            boxBlur(result, value);
            break;
        case "vintage":
            vintage(d, value);
            break;
        case "pixelate":
            pixelate(result, value);
            break;
        case "posterize":
            posterize(d, value);
            break;
        case "emboss":
            emboss(result, value);
            break;
        case "edge":
            edgeDetect(result);
            break;
        case "vignette":
            vignetteFilter(result, value);
            break;
        case "glitch":
            glitch(result, value);
            break;
        case "duotone":
            duotone(d, value);
            break;
        case "solarize":
            solarize(d, value);
            break;
        case "noise":
            noise(d, value);
            break;
    }

    return result;
}
