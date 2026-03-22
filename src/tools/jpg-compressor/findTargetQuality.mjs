function clampQuality(value) {
    const numeric = Number.isFinite(value) ? value : Number.parseInt(String(value ?? ""), 10);
    return Math.min(100, Math.max(1, Math.round(numeric || 1)));
}

function getByteLength(value) {
    if (typeof value === "number") {
        return value;
    }

    if (value instanceof ArrayBuffer) {
        return value.byteLength;
    }

    if (ArrayBuffer.isView(value)) {
        return value.byteLength;
    }

    if (value instanceof Blob) {
        return value.size;
    }

    if (value && typeof value === "object" && "byteLength" in value) {
        const byteLength = value.byteLength;
        if (typeof byteLength === "number") {
            return byteLength;
        }
    }

    throw new Error("Encoder result must expose a byte length.");
}

function pickSmaller(current, next) {
    if (!current) return next;
    if (next.byteLength < current.byteLength) return next;
    if (next.byteLength === current.byteLength && next.quality < current.quality) return next;
    return current;
}

function pickHigherQuality(current, next) {
    if (!current) return next;
    if (next.quality > current.quality) return next;
    return current;
}

/**
 * @template T
 * @param {{
 *   targetBytes: number;
 *   minQuality?: number;
 *   maxQuality?: number;
 * }} options
 * @param {(quality: number) => Promise<T> | T} measureAtQuality
 */
export async function findTargetQuality(options, measureAtQuality) {
    const targetBytes = Math.max(1, Math.round(options.targetBytes || 1));
    const minQuality = clampQuality(options.minQuality ?? 10);
    const maxQuality = clampQuality(Math.max(minQuality, options.maxQuality ?? 100));
    const cache = new Map();

    const measure = async (quality) => {
        const normalizedQuality = clampQuality(quality);
        if (!cache.has(normalizedQuality)) {
            cache.set(
                normalizedQuality,
                Promise.resolve(measureAtQuality(normalizedQuality)).then((value) => ({
                    quality: normalizedQuality,
                    byteLength: getByteLength(value),
                    value,
                })),
            );
        }

        return cache.get(normalizedQuality);
    };

    let smallest = await measure(minQuality);
    let bestUnderTarget = smallest.byteLength <= targetBytes ? smallest : null;

    let low = minQuality;
    let high = maxQuality;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = await measure(mid);

        smallest = pickSmaller(smallest, candidate);

        if (candidate.byteLength <= targetBytes) {
            bestUnderTarget = pickHigherQuality(bestUnderTarget, candidate);
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    if (!bestUnderTarget) {
        return {
            metTarget: false,
            quality: smallest.quality,
            byteLength: smallest.byteLength,
            value: smallest.value,
            attemptedQualities: [...cache.keys()].sort((a, b) => a - b),
        };
    }

    return {
        metTarget: true,
        quality: bestUnderTarget.quality,
        byteLength: bestUnderTarget.byteLength,
        value: bestUnderTarget.value,
        attemptedQualities: [...cache.keys()].sort((a, b) => a - b),
    };
}
