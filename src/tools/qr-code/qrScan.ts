import { loadImage } from "./qrImage";

export type QRWarning = { reason: string; tip: string };

export async function scanQRImage(svg: Blob, size: number, expected: string, signal: AbortSignal): Promise<QRWarning | null> {
    const url = URL.createObjectURL(svg);
    try {
        // Load only the decoder, and only once a completed image needs checking.
        const [{ default: decodeQR }, image] = await Promise.all([
            import("qr/decode.js"),
            loadImage(url),
        ]);
        signal.throwIfAborted();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Image scanning is unavailable.");
        // Transparent corners are scanned against a white surface, as in JPEG exports.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        const pixels = context.getImageData(0, 0, size, size);
        let decoded: string;
        try {
            decoded = decodeQR(pixels, { timeLimit: 50 });
        } catch {
            return { reason: "The local scan check couldn’t read this QR code.", tip: "Try simpler shapes, higher quality, or removing the logo." };
        }
        return decoded === expected ? null
            : { reason: "The local scan check read different content.", tip: "Try simpler text without special characters, then scan it with your phone before sharing." };
    } finally {
        URL.revokeObjectURL(url);
    }
}
