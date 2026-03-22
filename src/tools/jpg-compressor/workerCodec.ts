import mozjpegWasmUrl from "@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url";

type JpegEncoder = (data: ImageData, options?: { quality?: number }) => Promise<ArrayBuffer>;

let encoderPromise: Promise<JpegEncoder> | null = null;

export async function getJpegEncoder() {
    if (!encoderPromise) {
        encoderPromise = import("@jsquash/jpeg/encode").then(async (module) => {
            await module.init({
                locateFile: () => mozjpegWasmUrl,
            });

            return module.default;
        });
    }

    return encoderPromise;
}

export async function loadJpegSource(file: File) {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
        throw new Error("This browser does not support worker-based JPG compression.");
    }

    const bitmap = await createImageBitmap(file);

    try {
        const width = bitmap.width;
        const height = bitmap.height;
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
            throw new Error("Failed to prepare the image for compression.");
        }

        ctx.drawImage(bitmap, 0, 0, width, height);

        return {
            baseName: file.name.replace(/\.[^.]+$/, ""),
            height,
            imageData: ctx.getImageData(0, 0, width, height),
            width,
        };
    } finally {
        bitmap.close?.();
    }
}

export async function encodeJpegAtQuality(imageData: ImageData, quality: number) {
    const encode = await getJpegEncoder();
    const buffer = await encode(imageData, { quality });
    return new Blob([buffer], { type: "image/jpeg" });
}
