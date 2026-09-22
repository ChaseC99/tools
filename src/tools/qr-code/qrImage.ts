import { getAlphaBounds } from "./qrLogoLogic.mjs";
import type { LogoSource } from "./qrLogo";

export async function loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => {
            image.onload = image.onerror = null;
            image.src = "";
            reject(new Error("Image loading timed out. Try another image."));
        }, 10000);
        image.onload = () => { clearTimeout(timer); resolve(image); };
        image.onerror = () => { clearTimeout(timer); reject(new Error("Could not decode the image.")); };
        image.src = source;
    });
}

export async function prepareLogo(file: File): Promise<LogoSource> {
    const url = URL.createObjectURL(file);
    try {
        const image = await loadImage(url);
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image processing is unavailable.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const bounds = getAlphaBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (!bounds) throw new Error("This logo is fully transparent. Choose an image with visible artwork.");
        return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height, bounds };
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function exportQRImage(svg: Blob, size: number, format: "png" | "svg" | "jpeg"): Promise<Blob> {
    if (format === "svg") return svg;
    const url = URL.createObjectURL(svg);
    try {
        const image = await loadImage(url);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image export is unavailable.");
        if (format === "jpeg") {
            // JPEG cannot preserve the transparent corners of a rounded border.
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, size, size);
        }
        context.drawImage(image, 0, 0, size, size);
        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image export failed.")), `image/${format}`, 1);
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function copyQRImage(svg: Blob | Promise<Blob>, size: number): Promise<void> {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Image copying is not supported in this browser. Download the QR code instead.");
    }
    // Start the clipboard write during the click; awaiting conversion first
    // loses user activation in browsers such as Safari.
    await navigator.clipboard.write([
        new ClipboardItem({ "image/png": Promise.resolve(svg).then((blob) => exportQRImage(blob, size, "png")) }),
    ]);
}

export function downloadQRImage(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try {
        link.click();
    } finally {
        link.remove();
        // Allow the browser to consume the download before releasing its URL.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
