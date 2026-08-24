import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clamp, cloneImageData, loadImage, canvasToBlob, decodeHeic } from "@tools/shared/imageUtils";
import ImageInput from "@tools/shared/ImageInput";
import ErrorMessage from "@tools/shared/ErrorMessage";
import DownloadButton from "@tools/shared/DownloadButton";

type BlurType = "gaussian" | "box" | "motion" | "pixelate";
type TargetMode = "whole" | "regions";
type ExportFormat = "jpg" | "png" | "webp";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

type BlurParams = {
    radius: number;
    angle: number;
    blockSize: number;
};

type BlurRegion = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    feather: number;
    effectOverride?: BlurType;
    paramsOverride?: Partial<BlurParams>;
};

type PreviewRegion = BlurRegion & {
    x: number;
    y: number;
    width: number;
    height: number;
    feather: number;
};

type InteractionState =
    | { kind: "idle" }
    | { kind: "creating"; startX: number; startY: number; currentX: number; currentY: number }
    | { kind: "moving"; regionId: string; startX: number; startY: number; originX: number; originY: number }
    | {
          kind: "resizing";
          regionId: string;
          handle: ResizeHandle;
          startX: number;
          startY: number;
          origin: BlurRegion;
      };

type ImageMeta = {
    width: number;
    height: number;
    previewWidth: number;
    previewHeight: number;
};

const MAX_PREVIEW_WIDTH = 1400;
const MAX_PREVIEW_HEIGHT = 900;
const LARGE_IMAGE_WARNING_PIXELS = 24_000_000;
const MIN_REGION_SIZE = 4;
const HANDLE_SIZE = 10;
const SUPPORTED_INPUT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

const BLUR_LABELS: Record<BlurType, string> = {
    gaussian: "Gaussian",
    box: "Box",
    motion: "Motion",
    pixelate: "Pixelate/Mosaic",
};

const EXPORT_LABELS: Record<ExportFormat, string> = {
    jpg: "JPG",
    png: "PNG",
    webp: "WebP",
};

const EXPORT_MIME: Record<ExportFormat, string> = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};

function smoothstep(t: number): number {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

function detectInputExtension(file: File): string {
    return file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

function detectDefaultExportFormat(file: File): ExportFormat {
    const ext = detectInputExtension(file);
    if (ext === ".jpg" || ext === ".jpeg") return "jpg";
    if (ext === ".webp") return "webp";
    return "png";
}

function isLossyFormat(format: ExportFormat): boolean {
    return format === "jpg" || format === "webp";
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
        throw new Error("Failed to create canvas context.");
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function buildGaussianKernel(radius: number): number[] {
    const r = Math.max(1, Math.round(radius));
    const sigma = Math.max(0.5, r / 2);
    const size = r * 2 + 1;
    const kernel = new Array<number>(size);
    let sum = 0;

    for (let i = -r; i <= r; i += 1) {
        const value = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel[i + r] = value;
        sum += value;
    }

    for (let i = 0; i < kernel.length; i += 1) {
        kernel[i] /= sum;
    }

    return kernel;
}

function convolveHorizontal(src: Uint8ClampedArray, dst: Uint8ClampedArray, width: number, height: number, kernel: number[]): void {
    const radius = Math.floor(kernel.length / 2);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;

            for (let k = -radius; k <= radius; k += 1) {
                const sx = clamp(x + k, 0, width - 1);
                const idx = (y * width + sx) * 4;
                const w = kernel[k + radius];
                r += src[idx] * w;
                g += src[idx + 1] * w;
                b += src[idx + 2] * w;
                a += src[idx + 3] * w;
            }

            const out = (y * width + x) * 4;
            dst[out] = r;
            dst[out + 1] = g;
            dst[out + 2] = b;
            dst[out + 3] = a;
        }
    }
}

function convolveVertical(src: Uint8ClampedArray, dst: Uint8ClampedArray, width: number, height: number, kernel: number[]): void {
    const radius = Math.floor(kernel.length / 2);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;

            for (let k = -radius; k <= radius; k += 1) {
                const sy = clamp(y + k, 0, height - 1);
                const idx = (sy * width + x) * 4;
                const w = kernel[k + radius];
                r += src[idx] * w;
                g += src[idx + 1] * w;
                b += src[idx + 2] * w;
                a += src[idx + 3] * w;
            }

            const out = (y * width + x) * 4;
            dst[out] = r;
            dst[out + 1] = g;
            dst[out + 2] = b;
            dst[out + 3] = a;
        }
    }
}

function applyGaussianBlur(source: ImageData, radius: number): ImageData {
    const r = Math.max(1, Math.round(radius));
    const kernel = buildGaussianKernel(r);
    const temp = new Uint8ClampedArray(source.data.length);
    const out = new Uint8ClampedArray(source.data.length);

    convolveHorizontal(source.data, temp, source.width, source.height, kernel);
    convolveVertical(temp, out, source.width, source.height, kernel);

    return new ImageData(out, source.width, source.height);
}

function applyBoxBlur(source: ImageData, radius: number): ImageData {
    const r = Math.max(1, Math.round(radius));
    const width = source.width;
    const height = source.height;
    const src = source.data;
    const temp = new Uint8ClampedArray(src.length);
    const out = new Uint8ClampedArray(src.length);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let rr = 0;
            let gg = 0;
            let bb = 0;
            let aa = 0;
            let count = 0;
            for (let k = -r; k <= r; k += 1) {
                const sx = clamp(x + k, 0, width - 1);
                const idx = (y * width + sx) * 4;
                rr += src[idx];
                gg += src[idx + 1];
                bb += src[idx + 2];
                aa += src[idx + 3];
                count += 1;
            }
            const outIdx = (y * width + x) * 4;
            temp[outIdx] = rr / count;
            temp[outIdx + 1] = gg / count;
            temp[outIdx + 2] = bb / count;
            temp[outIdx + 3] = aa / count;
        }
    }

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let rr = 0;
            let gg = 0;
            let bb = 0;
            let aa = 0;
            let count = 0;
            for (let k = -r; k <= r; k += 1) {
                const sy = clamp(y + k, 0, height - 1);
                const idx = (sy * width + x) * 4;
                rr += temp[idx];
                gg += temp[idx + 1];
                bb += temp[idx + 2];
                aa += temp[idx + 3];
                count += 1;
            }
            const outIdx = (y * width + x) * 4;
            out[outIdx] = rr / count;
            out[outIdx + 1] = gg / count;
            out[outIdx + 2] = bb / count;
            out[outIdx + 3] = aa / count;
        }
    }

    return new ImageData(out, width, height);
}

function applyMotionBlur(source: ImageData, radius: number, angle: number): ImageData {
    const r = Math.max(1, Math.round(radius));
    const width = source.width;
    const height = source.height;
    const out = new Uint8ClampedArray(source.data.length);
    const src = source.data;
    const radians = (angle * Math.PI) / 180;
    const cosA = Math.cos(radians);
    const sinA = Math.sin(radians);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let rr = 0;
            let gg = 0;
            let bb = 0;
            let aa = 0;
            let count = 0;

            for (let i = -r; i <= r; i += 1) {
                const sx = clamp(Math.round(x + i * cosA), 0, width - 1);
                const sy = clamp(Math.round(y + i * sinA), 0, height - 1);
                const idx = (sy * width + sx) * 4;
                rr += src[idx];
                gg += src[idx + 1];
                bb += src[idx + 2];
                aa += src[idx + 3];
                count += 1;
            }

            const outIdx = (y * width + x) * 4;
            out[outIdx] = rr / count;
            out[outIdx + 1] = gg / count;
            out[outIdx + 2] = bb / count;
            out[outIdx + 3] = aa / count;
        }
    }

    return new ImageData(out, width, height);
}

function applyPixelate(source: ImageData, blockSize: number): ImageData {
    const size = Math.max(2, Math.round(blockSize));
    const width = source.width;
    const height = source.height;
    const src = source.data;
    const out = new Uint8ClampedArray(src);

    for (let by = 0; by < height; by += size) {
        for (let bx = 0; bx < width; bx += size) {
            const endX = Math.min(width, bx + size);
            const endY = Math.min(height, by + size);
            let rr = 0;
            let gg = 0;
            let bb = 0;
            let aa = 0;
            let count = 0;

            for (let y = by; y < endY; y += 1) {
                for (let x = bx; x < endX; x += 1) {
                    const idx = (y * width + x) * 4;
                    rr += src[idx];
                    gg += src[idx + 1];
                    bb += src[idx + 2];
                    aa += src[idx + 3];
                    count += 1;
                }
            }

            const avgR = rr / count;
            const avgG = gg / count;
            const avgB = bb / count;
            const avgA = aa / count;

            for (let y = by; y < endY; y += 1) {
                for (let x = bx; x < endX; x += 1) {
                    const idx = (y * width + x) * 4;
                    out[idx] = avgR;
                    out[idx + 1] = avgG;
                    out[idx + 2] = avgB;
                    out[idx + 3] = avgA;
                }
            }
        }
    }

    return new ImageData(out, width, height);
}

function applyBlurByType(source: ImageData, blurType: BlurType, params: BlurParams): ImageData {
    switch (blurType) {
        case "gaussian":
            return applyGaussianBlur(source, params.radius);
        case "box":
            return applyBoxBlur(source, params.radius);
        case "motion":
            return applyMotionBlur(source, params.radius, params.angle);
        case "pixelate":
            return applyPixelate(source, params.blockSize);
        default:
            return cloneImageData(source);
    }
}

function regionWeight(x: number, y: number, region: PreviewRegion): number {
    const left = region.x;
    const right = region.x + region.width;
    const top = region.y;
    const bottom = region.y + region.height;
    const feather = Math.max(0, region.feather);

    const insideX = x >= left && x <= right;
    const insideY = y >= top && y <= bottom;

    if (insideX && insideY) {
        if (feather <= 0) return 1;
        const distanceToEdge = Math.min(x - left, right - x, y - top, bottom - y);
        if (distanceToEdge >= feather) return 1;
        return smoothstep(distanceToEdge / feather);
    }

    if (feather <= 0) {
        return 0;
    }

    const dx = x < left ? left - x : x > right ? x - right : 0;
    const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
    const outsideDistance = Math.hypot(dx, dy);
    if (outsideDistance > feather) return 0;

    return smoothstep(1 - outsideDistance / feather);
}

function applyRegionalBlend(source: ImageData, blurred: ImageData, regions: PreviewRegion[]): ImageData {
    const out = new Uint8ClampedArray(source.data);
    const src = source.data;
    const blur = blurred.data;
    const width = source.width;
    const height = source.height;

    for (const region of regions) {
        const featherPad = Math.ceil(Math.max(0, region.feather));
        const minX = clamp(Math.floor(region.x - featherPad), 0, width - 1);
        const maxX = clamp(Math.ceil(region.x + region.width + featherPad), 0, width - 1);
        const minY = clamp(Math.floor(region.y - featherPad), 0, height - 1);
        const maxY = clamp(Math.ceil(region.y + region.height + featherPad), 0, height - 1);

        for (let y = minY; y <= maxY; y += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                const weight = regionWeight(x, y, region);
                if (weight <= 0) continue;

                const idx = (y * width + x) * 4;
                out[idx] = src[idx] * (1 - weight) + blur[idx] * weight;
                out[idx + 1] = src[idx + 1] * (1 - weight) + blur[idx + 1] * weight;
                out[idx + 2] = src[idx + 2] * (1 - weight) + blur[idx + 2] * weight;
                out[idx + 3] = src[idx + 3] * (1 - weight) + blur[idx + 3] * weight;
            }
        }
    }

    return new ImageData(out, width, height);
}

function mapRegionsToPreview(regions: BlurRegion[], scaleX: number, scaleY: number): PreviewRegion[] {
    const featherScale = (scaleX + scaleY) / 2;

    return regions.map((region) => ({
        ...region,
        x: region.x * scaleX,
        y: region.y * scaleY,
        width: region.width * scaleX,
        height: region.height * scaleY,
        feather: region.feather * featherScale,
    }));
}

function pointToCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return {
        x: clamp(x, 0, canvas.width),
        y: clamp(y, 0, canvas.height),
    };
}

function normalizeRect(aX: number, aY: number, bX: number, bY: number): { x: number; y: number; width: number; height: number } {
    const x = Math.min(aX, bX);
    const y = Math.min(aY, bY);
    return {
        x,
        y,
        width: Math.abs(aX - bX),
        height: Math.abs(aY - bY),
    };
}

function getPreviewRect(region: BlurRegion, imageMeta: ImageMeta): { x: number; y: number; width: number; height: number } {
    const scaleX = imageMeta.previewWidth / imageMeta.width;
    const scaleY = imageMeta.previewHeight / imageMeta.height;
    return {
        x: region.x * scaleX,
        y: region.y * scaleY,
        width: region.width * scaleX,
        height: region.height * scaleY,
    };
}

function isPointInRect(x: number, y: number, rect: { x: number; y: number; width: number; height: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function getHandleCenters(rect: { x: number; y: number; width: number; height: number }): Record<ResizeHandle, { x: number; y: number }> {
    return {
        nw: { x: rect.x, y: rect.y },
        ne: { x: rect.x + rect.width, y: rect.y },
        sw: { x: rect.x, y: rect.y + rect.height },
        se: { x: rect.x + rect.width, y: rect.y + rect.height },
    };
}

function hitResizeHandle(
    x: number,
    y: number,
    rect: { x: number; y: number; width: number; height: number },
): ResizeHandle | null {
    const handles = getHandleCenters(rect);
    for (const handle of Object.keys(handles) as ResizeHandle[]) {
        const center = handles[handle];
        if (Math.abs(x - center.x) <= HANDLE_SIZE && Math.abs(y - center.y) <= HANDLE_SIZE) {
            return handle;
        }
    }
    return null;
}

function resizeRegion(
    region: BlurRegion,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    maxWidth: number,
    maxHeight: number,
): BlurRegion {
    let x = region.x;
    let y = region.y;
    let width = region.width;
    let height = region.height;

    if (handle === "nw" || handle === "sw") {
        x = clamp(region.x + dx, 0, region.x + region.width - MIN_REGION_SIZE);
        width = region.width + (region.x - x);
    }
    if (handle === "nw" || handle === "ne") {
        y = clamp(region.y + dy, 0, region.y + region.height - MIN_REGION_SIZE);
        height = region.height + (region.y - y);
    }
    if (handle === "ne" || handle === "se") {
        const newRight = clamp(region.x + region.width + dx, region.x + MIN_REGION_SIZE, maxWidth);
        width = newRight - region.x;
    }
    if (handle === "sw" || handle === "se") {
        const newBottom = clamp(region.y + region.height + dy, region.y + MIN_REGION_SIZE, maxHeight);
        height = newBottom - region.y;
    }

    return {
        ...region,
        x,
        y,
        width,
        height,
    };
}

function shouldIgnoreKeyTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
}

function extractBaseName(fileName: string): string {
    return fileName.replace(/\.[^.]+$/, "") || "image";
}

export default function BlurImage() {
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const previewOriginalDataRef = useRef<ImageData | null>(null);
    const interactionRef = useRef<InteractionState>({ kind: "idle" });
    const fileBaseNameRef = useRef("image");

    const [dragging, setDragging] = useState(false);
    const [fileLabel, setFileLabel] = useState("");
    const [loadingImage, setLoadingImage] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);

    const [blurType, setBlurType] = useState<BlurType>("gaussian");
    const [targetMode, setTargetMode] = useState<TargetMode>("whole");
    const [blurParams, setBlurParams] = useState<BlurParams>({ radius: 10, angle: 0, blockSize: 16 });

    const [regions, setRegions] = useState<BlurRegion[]>([]);
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

    const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
    const [quality, setQuality] = useState(0.92);

    const hasImage = imageMeta !== null && previewOriginalDataRef.current !== null;

    const selectedRegion = useMemo(
        () => regions.find((region) => region.id === selectedRegionId) ?? null,
        [regions, selectedRegionId],
    );

    const drawRegionOverlay = useCallback(
        (ctx: CanvasRenderingContext2D) => {
            if (!imageMeta) return;

            for (const region of regions) {
                const rect = getPreviewRect(region, imageMeta);
                const isSelected = region.id === selectedRegionId;

                ctx.save();
                ctx.strokeStyle = isSelected ? "#57a0ff" : "rgba(255, 255, 255, 0.8)";
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.setLineDash(isSelected ? [] : [6, 4]);
                ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

                if (isSelected) {
                    const handles = getHandleCenters(rect);
                    ctx.fillStyle = "#57a0ff";
                    for (const point of Object.values(handles)) {
                        ctx.fillRect(point.x - 4, point.y - 4, 8, 8);
                    }
                }
                ctx.restore();
            }

            if (draftRect) {
                ctx.save();
                ctx.strokeStyle = "#57a0ff";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 4]);
                ctx.strokeRect(draftRect.x, draftRect.y, draftRect.width, draftRect.height);
                ctx.restore();
            }
        },
        [draftRect, imageMeta, regions, selectedRegionId],
    );

    const renderPreview = useCallback(() => {
        const displayCanvas = displayCanvasRef.current;
        const previewSource = previewOriginalDataRef.current;
        const meta = imageMeta;
        if (!displayCanvas || !previewSource || !meta) return;

        const ctx = displayCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const run = () => {
            let finalData: ImageData;

            if (targetMode === "whole" || regions.length === 0) {
                finalData = applyBlurByType(previewSource, blurType, blurParams);
            } else {
                const scaleX = meta.previewWidth / meta.width;
                const scaleY = meta.previewHeight / meta.height;
                const mappedRegions = mapRegionsToPreview(regions, scaleX, scaleY);
                const blurred = applyBlurByType(previewSource, blurType, blurParams);
                finalData = applyRegionalBlend(previewSource, blurred, mappedRegions);
            }

            displayCanvas.width = meta.previewWidth;
            displayCanvas.height = meta.previewHeight;
            ctx.putImageData(finalData, 0, 0);
            if (targetMode === "regions") {
                drawRegionOverlay(ctx);
            }
        };

        if (typeof window !== "undefined") {
            window.requestAnimationFrame(run);
        } else {
            run();
        }
    }, [blurParams, blurType, drawRegionOverlay, imageMeta, regions, targetMode]);

    useEffect(() => {
        if (!hasImage) return;
        const timeout = window.setTimeout(() => {
            renderPreview();
        }, 24);
        return () => window.clearTimeout(timeout);
    }, [hasImage, renderPreview]);

    useEffect(() => {
        if (!hasImage || targetMode !== "regions") return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (shouldIgnoreKeyTarget(event.target)) return;

            if (event.key === "Escape") {
                setSelectedRegionId(null);
                setDraftRect(null);
                interactionRef.current = { kind: "idle" };
                return;
            }

            if ((event.key === "Delete" || event.key === "Backspace") && selectedRegionId) {
                event.preventDefault();
                setRegions((prev) => prev.filter((region) => region.id !== selectedRegionId));
                setSelectedRegionId(null);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [hasImage, selectedRegionId, targetMode]);

    const loadFile = useCallback(async (file: File) => {
        const extension = detectInputExtension(file);
        if (!SUPPORTED_INPUT_EXTENSIONS.includes(extension)) {
            setError("Unsupported file type. Please use JPG, PNG, WebP, or HEIC.");
            return;
        }

        setError(null);
        setWarning(null);
        setLoadingImage(true);

        try {
            let sourceBlob: Blob = file;
            if (extension === ".heic" || extension === ".heif") {
                try {
                    sourceBlob = await decodeHeic(file);
                } catch {
                    setError("Could not decode HEIC file. Try converting to JPG or PNG first.");
                    return;
                }
            }

            const objectUrl = URL.createObjectURL(sourceBlob);
            const image = await loadImage(objectUrl);
            URL.revokeObjectURL(objectUrl);

            const sourceCanvas = document.createElement("canvas");
            sourceCanvas.width = image.naturalWidth;
            sourceCanvas.height = image.naturalHeight;
            const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
            if (!sourceCtx) {
                setError("Could not initialize image processing context.");
                return;
            }
            sourceCtx.drawImage(image, 0, 0);

            const scale = Math.min(MAX_PREVIEW_WIDTH / image.naturalWidth, MAX_PREVIEW_HEIGHT / image.naturalHeight, 1);
            const previewWidth = Math.max(1, Math.round(image.naturalWidth * scale));
            const previewHeight = Math.max(1, Math.round(image.naturalHeight * scale));

            const previewCanvas = document.createElement("canvas");
            previewCanvas.width = previewWidth;
            previewCanvas.height = previewHeight;
            const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });
            if (!previewCtx) {
                setError("Could not initialize preview context.");
                return;
            }
            previewCtx.drawImage(sourceCanvas, 0, 0, previewWidth, previewHeight);
            const previewData = previewCtx.getImageData(0, 0, previewWidth, previewHeight);

            sourceCanvasRef.current = sourceCanvas;
            previewOriginalDataRef.current = previewData;
            fileBaseNameRef.current = extractBaseName(file.name);

            setImageMeta({
                width: image.naturalWidth,
                height: image.naturalHeight,
                previewWidth,
                previewHeight,
            });
            setFileLabel(file.name);
            setRegions([]);
            setSelectedRegionId(null);
            setDraftRect(null);
            setTargetMode("whole");
            setExportFormat(detectDefaultExportFormat(file));

            if (image.naturalWidth * image.naturalHeight > LARGE_IMAGE_WARNING_PIXELS) {
                setWarning("Large image detected. Live preview is downscaled for speed; final export remains full resolution.");
            }
        } catch {
            setError("Could not load that image. Please try another file.");
        } finally {
            setLoadingImage(false);
        }
    }, []);

    const getImagePointFromEvent = useCallback(
        (clientX: number, clientY: number): { x: number; y: number } | null => {
            const canvas = displayCanvasRef.current;
            const meta = imageMeta;
            if (!canvas || !meta) return null;
            const canvasPoint = pointToCanvasPoint(canvas, clientX, clientY);
            const scaleX = meta.width / meta.previewWidth;
            const scaleY = meta.height / meta.previewHeight;
            return {
                x: canvasPoint.x * scaleX,
                y: canvasPoint.y * scaleY,
            };
        },
        [imageMeta],
    );

    const pickRegionAtPoint = useCallback(
        (canvasX: number, canvasY: number): { region: BlurRegion; handle: ResizeHandle | null } | null => {
            const meta = imageMeta;
            if (!meta) return null;

            const ordered = [...regions].reverse();
            for (const region of ordered) {
                const rect = getPreviewRect(region, meta);
                const handle = hitResizeHandle(canvasX, canvasY, rect);
                if (handle) {
                    return { region, handle };
                }
                if (isPointInRect(canvasX, canvasY, rect)) {
                    return { region, handle: null };
                }
            }

            return null;
        },
        [imageMeta, regions],
    );

    const onCanvasPointerDown = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (!hasImage || targetMode !== "regions") return;
            const canvas = displayCanvasRef.current;
            if (!canvas || !imageMeta) return;

            const canvasPoint = pointToCanvasPoint(canvas, event.clientX, event.clientY);
            const imagePoint = getImagePointFromEvent(event.clientX, event.clientY);
            if (!imagePoint) return;

            canvas.setPointerCapture(event.pointerId);

            const hit = pickRegionAtPoint(canvasPoint.x, canvasPoint.y);
            if (!hit) {
                setSelectedRegionId(null);
                interactionRef.current = {
                    kind: "creating",
                    startX: imagePoint.x,
                    startY: imagePoint.y,
                    currentX: imagePoint.x,
                    currentY: imagePoint.y,
                };
                setDraftRect({ x: canvasPoint.x, y: canvasPoint.y, width: 0, height: 0 });
                return;
            }

            setSelectedRegionId(hit.region.id);
            if (hit.handle) {
                interactionRef.current = {
                    kind: "resizing",
                    regionId: hit.region.id,
                    handle: hit.handle,
                    startX: imagePoint.x,
                    startY: imagePoint.y,
                    origin: { ...hit.region },
                };
                return;
            }

            interactionRef.current = {
                kind: "moving",
                regionId: hit.region.id,
                startX: imagePoint.x,
                startY: imagePoint.y,
                originX: hit.region.x,
                originY: hit.region.y,
            };
        },
        [getImagePointFromEvent, hasImage, imageMeta, pickRegionAtPoint, targetMode],
    );

    const onCanvasPointerMove = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (!hasImage || targetMode !== "regions" || !imageMeta) return;
            const canvas = displayCanvasRef.current;
            if (!canvas) return;

            const interaction = interactionRef.current;
            if (interaction.kind === "idle") return;

            const imagePoint = getImagePointFromEvent(event.clientX, event.clientY);
            if (!imagePoint) return;

            if (interaction.kind === "creating") {
                interaction.currentX = imagePoint.x;
                interaction.currentY = imagePoint.y;
                interactionRef.current = interaction;

                const previewPoint = pointToCanvasPoint(canvas, event.clientX, event.clientY);
                const startPreviewX = (interaction.startX / imageMeta.width) * imageMeta.previewWidth;
                const startPreviewY = (interaction.startY / imageMeta.height) * imageMeta.previewHeight;
                setDraftRect(normalizeRect(startPreviewX, startPreviewY, previewPoint.x, previewPoint.y));
                return;
            }

            if (interaction.kind === "moving") {
                const dx = imagePoint.x - interaction.startX;
                const dy = imagePoint.y - interaction.startY;

                setRegions((prev) =>
                    prev.map((region) => {
                        if (region.id !== interaction.regionId) return region;
                        const nextX = clamp(interaction.originX + dx, 0, imageMeta.width - region.width);
                        const nextY = clamp(interaction.originY + dy, 0, imageMeta.height - region.height);
                        return { ...region, x: nextX, y: nextY };
                    }),
                );
                return;
            }

            if (interaction.kind === "resizing") {
                const dx = imagePoint.x - interaction.startX;
                const dy = imagePoint.y - interaction.startY;

                setRegions((prev) =>
                    prev.map((region) => {
                        if (region.id !== interaction.regionId) return region;
                        return resizeRegion(interaction.origin, interaction.handle, dx, dy, imageMeta.width, imageMeta.height);
                    }),
                );
            }
        },
        [getImagePointFromEvent, hasImage, imageMeta, targetMode],
    );

    const onCanvasPointerUp = useCallback(() => {
        if (!imageMeta) return;
        const interaction = interactionRef.current;

        if (interaction.kind === "creating") {
            const rect = normalizeRect(interaction.startX, interaction.startY, interaction.currentX, interaction.currentY);
            setDraftRect(null);
            if (rect.width >= MIN_REGION_SIZE && rect.height >= MIN_REGION_SIZE) {
                const id = `region-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const next: BlurRegion = {
                    id,
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    feather: 0,
                };
                setRegions((prev) => [...prev, next]);
                setSelectedRegionId(id);
            }
        }

        interactionRef.current = { kind: "idle" };
    }, [imageMeta]);

    const updateSelectedRegion = useCallback((patch: Partial<BlurRegion>) => {
        if (!selectedRegionId) return;
        setRegions((prev) =>
            prev.map((region) => {
                if (region.id !== selectedRegionId) return region;
                return { ...region, ...patch };
            }),
        );
    }, [selectedRegionId]);

    const removeSelectedRegion = useCallback(() => {
        if (!selectedRegionId) return;
        setRegions((prev) => prev.filter((region) => region.id !== selectedRegionId));
        setSelectedRegionId(null);
    }, [selectedRegionId]);

    const handleDownload = useCallback(async () => {
        if (!sourceCanvasRef.current || !imageMeta) return;

        try {
            setError(null);

            const sourceCtx = sourceCanvasRef.current.getContext("2d", { willReadFrequently: true });
            if (!sourceCtx) {
                setError("Could not export image.");
                return;
            }

            const sourceData = sourceCtx.getImageData(0, 0, imageMeta.width, imageMeta.height);
            let finalData: ImageData;

            if (targetMode === "whole" || regions.length === 0) {
                finalData = applyBlurByType(sourceData, blurType, blurParams);
            } else {
                const blurred = applyBlurByType(sourceData, blurType, blurParams);
                finalData = applyRegionalBlend(sourceData, blurred, regions);
            }

            const outputCanvas = imageDataToCanvas(finalData);
            const blob = await canvasToBlob(
                outputCanvas,
                EXPORT_MIME[exportFormat],
                isLossyFormat(exportFormat) ? quality : undefined,
            );

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${fileBaseNameRef.current}-blurred.${exportFormat}`;
            link.click();
            URL.revokeObjectURL(url);
        } catch {
            setError("Could not export image. Please try again.");
        }
    }, [blurParams, blurType, exportFormat, imageMeta, quality, regions, targetMode]);

    return (
        <div className="ui-stack">
            <ImageInput
                onFile={loadFile}
                dragging={dragging}
                onDraggingChange={setDragging}
                accept="image/jpeg,image/png,image/webp,.heic,.heif"
                formats={["JPG", "PNG", "WebP", "HEIC"]}
                fileName={fileLabel || null}
                loading={loadingImage}
                loadingLabel="Loading image…"
            />

            <p className="ui-hint" style={{ textAlign: "center" }}>
                Blur the whole image or draw regions using the controls below.
            </p>

            {warning && (
                <div className="ui-alert" data-variant="warning">
                    {warning}
                </div>
            )}

            <ErrorMessage message={error} />

            <div className="ui-grid">
                <label className="ui-field">
                    <span className="ui-label">Blur type</span>
                    <select className="ui-select" value={blurType} onChange={(event) => setBlurType(event.target.value as BlurType)}>
                        {(Object.keys(BLUR_LABELS) as BlurType[]).map((type) => (
                            <option key={type} value={type}>
                                {BLUR_LABELS[type]}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="ui-field">
                    <span className="ui-label">Apply to</span>
                    <select className="ui-select" value={targetMode} onChange={(event) => setTargetMode(event.target.value as TargetMode)}>
                        <option value="whole">Whole image</option>
                        <option value="regions">Rectangle regions</option>
                    </select>
                </label>

                <label className="ui-field">
                    <span className="ui-label">Export format</span>
                    <select className="ui-select" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)}>
                        {(Object.keys(EXPORT_LABELS) as ExportFormat[]).map((format) => (
                            <option key={format} value={format}>
                                {EXPORT_LABELS[format]}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="ui-grid">
                {blurType === "pixelate" ? (
                    <label className="ui-field">
                        <span className="ui-label">Block size: {Math.round(blurParams.blockSize)} px</span>
                        <input
                            className="ui-range"
                            type="range"
                            min={2}
                            max={48}
                            step={1}
                            value={blurParams.blockSize}
                            onChange={(event) =>
                                setBlurParams((prev) => ({ ...prev, blockSize: Number(event.target.value) }))
                            }
                        />
                    </label>
                ) : (
                    <label className="ui-field">
                        <span className="ui-label">Radius: {Math.round(blurParams.radius)} px</span>
                        <input
                            className="ui-range"
                            type="range"
                            min={1}
                            max={40}
                            step={1}
                            value={blurParams.radius}
                            onChange={(event) => setBlurParams((prev) => ({ ...prev, radius: Number(event.target.value) }))}
                        />
                    </label>
                )}

                {blurType === "motion" && (
                    <label className="ui-field">
                        <span className="ui-label">Angle: {Math.round(blurParams.angle)}°</span>
                        <input
                            className="ui-range"
                            type="range"
                            min={0}
                            max={180}
                            step={1}
                            value={blurParams.angle}
                            onChange={(event) => setBlurParams((prev) => ({ ...prev, angle: Number(event.target.value) }))}
                        />
                    </label>
                )}

                {isLossyFormat(exportFormat) && (
                    <label className="ui-field">
                        <span className="ui-label">Export quality: {Math.round(quality * 100)}%</span>
                        <input
                            className="ui-range"
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.01}
                            value={quality}
                            onChange={(event) => setQuality(Number(event.target.value))}
                        />
                    </label>
                )}

                {targetMode === "regions" && selectedRegion && (
                    <label className="ui-field">
                        <span className="ui-label">Selected region feather: {Math.round(selectedRegion.feather)} px</span>
                        <input
                            className="ui-range"
                            type="range"
                            min={0}
                            max={80}
                            step={1}
                            value={selectedRegion.feather}
                            onChange={(event) => updateSelectedRegion({ feather: Number(event.target.value) })}
                        />
                    </label>
                )}
            </div>

            <div className="ui-action-bar">
                {targetMode === "regions" && selectedRegion && (
                    <button className="ui-button" data-variant="danger" type="button" onClick={removeSelectedRegion}>Delete selected region</button>
                )}
            </div>

            <div className="ui-panel ui-stack" data-variant="inset">
                <p className="ui-muted" style={{ textAlign: "center" }}>
                    {targetMode === "regions"
                        ? "Drag on the image to create a rectangle. Drag inside to move it, drag corner handles to resize. Use Delete/Backspace to remove selected region."
                        : "Blur is applied to the whole image."}
                </p>
                <div className="blur-canvas-wrap">
                    <canvas
                        ref={displayCanvasRef}
                        onPointerDown={onCanvasPointerDown}
                        onPointerMove={onCanvasPointerMove}
                        onPointerUp={onCanvasPointerUp}
                        onPointerCancel={onCanvasPointerUp}
                        className="blur-canvas"
                        style={{
                            width: imageMeta ? `${imageMeta.previewWidth}px` : "100%",
                            minHeight: hasImage ? undefined : 220,
                            background: "repeating-conic-gradient(#f3f3f3 0% 25%, #ffffff 0% 50%) 50% / 24px 24px",
                            touchAction: "none",
                            cursor: targetMode === "regions" ? "crosshair" : "default",
                        }}
                    />
                </div>
                <div className="ui-action-bar ui-action-bar--center">
                    <DownloadButton
                        onClick={handleDownload}
                        disabled={!hasImage}
                        filename={`image-blurred`}
                        label="Download blurred image"
                    />
                </div>
            </div>

            <p className="ui-hint" style={{ textAlign: "center" }}>
                All blurring happens in your browser—no images are saved or uploaded.
            </p>
        </div>
    );
}
