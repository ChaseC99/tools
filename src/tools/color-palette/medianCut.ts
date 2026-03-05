export type RGB = [number, number, number];

export function extractPalette(imageData: ImageData, colorCount: number): RGB[] {
    const pixels = parsePixels(imageData);

    if (pixels.length === 0) return [[128, 128, 128]];

    const unique = new Set(pixels.map(([r, g, b]) => `${r},${g},${b}`));
    const clampedCount = Math.min(colorCount, unique.size);

    if (clampedCount <= 1) {
        return [averageBucket(pixels)];
    }

    let buckets: RGB[][] = [pixels];

    while (buckets.length < clampedCount) {
        let widest = 0;
        let widestRange = -1;

        for (let i = 0; i < buckets.length; i++) {
            const range = maxChannelRange(buckets[i]);
            if (range > widestRange) {
                widestRange = range;
                widest = i;
            }
        }

        if (widestRange === 0) break;

        const [a, b] = splitBucket(buckets[widest]);
        buckets.splice(widest, 1, a, b);
    }

    const palette = buckets.map(averageBucket);
    palette.sort((a, b) => luminance(a) - luminance(b));
    return palette;
}

function parsePixels(imageData: ImageData): RGB[] {
    const { data } = imageData;
    const pixels: RGB[] = [];
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    return pixels;
}

function maxChannelRange(bucket: RGB[]): number {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const [r, g, b] of bucket) {
        if (r < rMin) rMin = r; if (r > rMax) rMax = r;
        if (g < gMin) gMin = g; if (g > gMax) gMax = g;
        if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    }
    return Math.max(rMax - rMin, gMax - gMin, bMax - bMin);
}

function splitBucket(bucket: RGB[]): [RGB[], RGB[]] {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const [r, g, b] of bucket) {
        if (r < rMin) rMin = r; if (r > rMax) rMax = r;
        if (g < gMin) gMin = g; if (g > gMax) gMax = g;
        if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    }

    const rRange = rMax - rMin;
    const gRange = gMax - gMin;
    const bRange = bMax - bMin;

    let channel: 0 | 1 | 2;
    if (rRange >= gRange && rRange >= bRange) channel = 0;
    else if (gRange >= bRange) channel = 1;
    else channel = 2;

    bucket.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(bucket.length / 2);
    return [bucket.slice(0, mid), bucket.slice(mid)];
}

function averageBucket(bucket: RGB[]): RGB {
    let r = 0, g = 0, b = 0;
    for (const [pr, pg, pb] of bucket) {
        r += pr; g += pg; b += pb;
    }
    const n = bucket.length;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function luminance([r, g, b]: RGB): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}
