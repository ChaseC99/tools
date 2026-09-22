import qrcode from "qrcode-generator";

export const DEFAULT_BORDER_SPACING = 4;

export const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(value);

export function normalizeWebsiteUrl(value) {
    const url = value.trim();
    if (!url) return "";
    if (url.startsWith("//")) return `https:${url}`;
    // A host followed by a port is not a protocol (e.g. localhost:3000).
    const hasPort = /^[^/?#]+:\d+(?:[/?#]|$)/.test(url);
    if (!hasPort && /^[a-z][a-z\d+.-]*:/i.test(url)) return url;
    return `https://${url}`;
}

function luminance(color) {
    const channels = [1, 3, 5].map((offset) => {
        const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getColorWarning(foreground, background) {
    if (foreground.toLowerCase() === background.toLowerCase()) {
        return { reason: "Foreground and background are identical.", tip: "Choose different colors, with dark dots on a light background." };
    }
    const fg = luminance(foreground);
    const bg = luminance(background);
    const contrast = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    // A conservative design hint, not a guarantee that a scanner can read the code.
    if (contrast < 4.5) return { reason: "These colors have low contrast.", tip: "Choose colors with more contrast to make your QR code easier to scan." };
    if (fg > bg) return { reason: "Light dots on a dark background may not scan in every app.", tip: "Swap the foreground and background colors for more reliable scanning." };
    return null;
}

export function getQRLayout(data, size, errorCorrectionLevel, spacingPercent = DEFAULT_BORDER_SPACING) {
    // Match qr-code-styling's automatic mode selection exactly.
    /** @type {import("qr-code-styling").Mode} */
    const mode = /^[0-9]*$/.test(data) ? "Numeric"
        : /^[0-9A-Z $%*+\-./:]*$/.test(data) ? "Alphanumeric" : "Byte";
    const code = qrcode(0, errorCorrectionLevel);
    code.addData(data, mode);
    try {
        code.make();
    } catch {
        throw new Error("This content is too long for a QR code at the selected error correction level. Shorten the content or lower error correction.");
    }
    const moduleCount = code.getModuleCount();
    const requestedSpacing = Math.ceil(size * spacingPercent / 100);
    const moduleSize = Math.floor((size - 2 * requestedSpacing) / moduleCount);
    if (moduleSize < 1) {
        throw new Error("This content is too dense for the selected quality and border. Choose higher quality, reduce border spacing, or shorten the content.");
    }
    // Center whole pixels; rounding may leave a few extra pixels at the edges.
    const margin = Math.floor((size - moduleCount * moduleSize) / 2);
    // At the QR's corner, a rounded background needs an inset of
    // radius * (1 - 1/sqrt(2)). Limit the radius, never enlarge the margin.
    const maxRadiusPercent = Math.min(25, Math.floor(100 * margin / (size * (1 - Math.SQRT1_2))));
    return { margin, moduleCount, moduleSize, mode, maxRadiusPercent };
}

/** Serialize asynchronous logo rendering and discard superseded requests. */
export function createQRRenderer(Renderer) {
    const renderer = new Renderer({ type: "svg" });
    let queue = Promise.resolve();
    return (options, isCurrent = () => true) => {
        const job = queue.then(async () => {
            if (!isCurrent()) return null;
            renderer.update(options);
            const blob = await renderer.getRawData("svg");
            if (!(blob instanceof Blob)) throw new Error("Could not generate the QR image. Try changing the settings.");
            return isCurrent() ? blob : null;
        });
        queue = job.catch(() => {});
        return job;
    };
}

/** Share each render between the preview and any actions using those settings. */
export function createQRImageSource(render) {
    let currentJob;
    return (request, getOptions, retain = false) => {
        if (currentJob?.request === request) {
            currentJob.retain ||= retain;
            return currentJob.promise;
        }
        const job = { request, retain, promise: undefined };
        job.promise = Promise.resolve().then(async () => {
            const blob = await render(getOptions(), () => currentJob === job || job.retain);
            if (!blob) throw new Error("QR settings changed before rendering completed.");
            return blob;
        });
        currentJob = job;
        return job.promise;
    };
}
