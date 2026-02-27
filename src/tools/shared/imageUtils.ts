export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function cloneImageData(source: ImageData): ImageData {
    return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
    });
}

export function canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality?: number,
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas conversion failed"));
            },
            mimeType,
            quality,
        );
    });
}

export async function decodeHeic(blob: Blob): Promise<Blob> {
    const { heicTo } = await import("heic-to");
    return await heicTo({ blob, type: "image/png", quality: 0.92 });
}
