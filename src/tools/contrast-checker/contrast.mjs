/** Normalize opaque sRGB hex colors; reject alpha and other CSS formats. */
export function normalizeHex(value) {
    if (typeof value !== "string") return null;
    const hex = value.trim().replace(/^#/, "");
    if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return null;
    return `#${(hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex).toUpperCase()}`;
}

// WCAG 2.2 relative luminance for sRGB:
// https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
function luminance(hex) {
    const channels = [1, 3, 5].map((offset) => {
        const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export const CONTRAST_CHECKS = [
    { label: "Normal text · AA", minimum: 4.5 },
    { label: "Normal text · AAA", minimum: 7 },
    { label: "Large text · AA", minimum: 3 },
    { label: "Large text · AAA", minimum: 4.5 },
    { label: "UI components & graphics · AA", minimum: 3 },
    // Matches the QR generator's design guidance, not a scan guarantee or WCAG criterion.
    { label: "QR code · Recommended", minimum: 3, darkForeground: true, hint: "At least 3.0:1 · dark code on light background" },
];

export function calculateContrast(foreground, background) {
    const first = normalizeHex(foreground);
    const second = normalizeHex(background);
    if (!first || !second) return null;
    const a = luminance(first);
    const b = luminance(second);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return {
        ratio,
        // Compare full precision, never the rounded display value.
        checks: CONTRAST_CHECKS.map((check) => ({
            ...check,
            passes: ratio >= check.minimum && (!check.darkForeground || a < b),
        })),
    };
}
