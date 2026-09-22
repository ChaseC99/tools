import { getLogoPlacement } from "./qrLogoLogic.mjs";

export type LogoSource = {
    dataUrl: string;
    width: number;
    height: number;
    bounds: { x: number; y: number; width: number; height: number };
};
export type LogoSettings = {
    size: number;
    shape: "none" | "square" | "rounded" | "circle";
    // Null follows the QR background until a backing color is chosen.
    color: string | null;
    padding: number;
    fit: "fit" | "fill";
};
export type LogoOverlay = { source: LogoSource; settings: LogoSettings };
export const DEFAULT_LOGO_SETTINGS: LogoSettings = {
    size: 18, shape: "rounded", color: null, padding: 0,
    fit: "fill",
};

function shapeMarkup(shape: LogoSettings["shape"], inset: number, size: number) {
    return shape === "circle"
        ? `<circle cx="50" cy="50" r="${size / 2}"/>`
        : `<rect x="${inset}" y="${inset}" width="${size}" height="${size}" rx="${shape === "rounded" ? size * 0.2 : 0}"/>`;
}

/** Source images are normalized PNG data URLs; all other attributes are controlled settings. */
export function logoMarkup({ source, settings }: LogoOverlay, background: string, prefix = "qr-logo") {
    const { shape, padding, color, fit } = settings;
    // Fill frames the visible artwork; Fit preserves the original image bounds.
    const bounds = fit === "fill" ? source.bounds : { x: 0, y: 0, width: source.width, height: source.height };
    const innerSize = 100 - padding * 2;
    // In Fit mode, inscribe the rectangular artwork within curved crop frames.
    const fitScale = shape === "circle" ? Math.SQRT1_2
        : shape === "rounded" ? 1 - 0.4 * (1 - Math.SQRT1_2) : 1;
    const frameSize = fit === "fit" ? innerSize * fitScale : innerSize;
    const frame = { x: (100 - frameSize) / 2, y: (100 - frameSize) / 2, size: frameSize };
    const placement = getLogoPlacement(bounds, frame, fit);
    const outerShape = shapeMarkup(shape, 0, 100);
    return `<defs><clipPath id="${prefix}-crop">${shapeMarkup(shape, padding, innerSize)}</clipPath></defs>
        <g fill="${shape === "none" ? background : color ?? background}">${outerShape}</g>
        <g clip-path="url(#${prefix}-crop)"><svg x="${frame.x}" y="${frame.y}" width="${frame.size}" height="${frame.size}" overflow="hidden">
        <image href="${source.dataUrl}" x="${placement.x - frame.x}" y="${placement.y - frame.y}" width="${source.width * placement.scale}" height="${source.height * placement.scale}"/>
        </svg></g>`;
}

/** Add the same centered overlay to the SVG used for preview, scanning, and export. */
export async function addLogoOverlay(blob: Blob, overlay: LogoOverlay, size: number, margin: number, background: string) {
    const document = new DOMParser().parseFromString(await blob.text(), "image/svg+xml");
    const width = (size - 2 * margin) * overlay.settings.size / 100;
    const offset = (size - width) / 2;
    const logo = new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg" x="${offset}" y="${offset}" width="${width}" height="${width}" viewBox="0 0 100 100">${logoMarkup(overlay, background)}</svg>`,
        "image/svg+xml",
    );
    document.documentElement.appendChild(document.importNode(logo.documentElement, true));
    return new Blob([new XMLSerializer().serializeToString(document)], { type: "image/svg+xml" });
}
