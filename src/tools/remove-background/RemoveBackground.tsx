import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { canvasToBlob, clamp, cloneImageData, loadImage } from "@tools/shared/imageUtils";
import ImageInput from "@tools/shared/ImageInput";
import ErrorMessage from "@tools/shared/ErrorMessage";
import DownloadButton from "@tools/shared/DownloadButton";
import Spinner from "@tools/shared/Spinner";

type Mode = "auto" | "click" | "remove-color" | "brush";

type Point = {
    x: number;
    y: number;
};

type BrushPreview = {
    visible: boolean;
    x: number;
    y: number;
    diameter: number;
};

const MAX_HISTORY = 20;
const MAX_PREVIEW_WIDTH = 960;
const MAX_PREVIEW_HEIGHT = 560;
const AUTO_REMOVE_ANIMATIONS = `
@keyframes remove-background-overlay-sweep {
    0% { transform: translateX(-135%); }
    100% { transform: translateX(135%); }
}

@keyframes remove-background-overlay-pulse {
    0%, 100% { opacity: 0.82; }
    50% { opacity: 0.96; }
}

@keyframes remove-background-overlay-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
`;

function updatePreviewCanvasSize(
    canvas: HTMLCanvasElement,
    imageWidth: number,
    imageHeight: number,
): { width: number; height: number } {
    const scale = Math.min(
        MAX_PREVIEW_WIDTH / imageWidth,
        MAX_PREVIEW_HEIGHT / imageHeight,
        1,
    );
    const width = Math.max(1, Math.round(imageWidth * scale));
    const height = Math.max(1, Math.round(imageHeight * scale));
    canvas.width = width;
    canvas.height = height;
    return { width, height };
}

function getCanvasPoint(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
    imageWidth: number,
    imageHeight: number,
): Point {
    const rect = canvas.getBoundingClientRect();
    const rawX = (clientX - rect.left) * (imageWidth / rect.width);
    const rawY = (clientY - rect.top) * (imageHeight / rect.height);

    return {
        x: Math.floor(clamp(rawX, 0, imageWidth - 1)),
        y: Math.floor(clamp(rawY, 0, imageHeight - 1)),
    };
}

function colorDistanceSquared(
    aR: number,
    aG: number,
    aB: number,
    bR: number,
    bG: number,
    bB: number,
): number {
    const dr = aR - bR;
    const dg = aG - bG;
    const db = aB - bB;
    return dr * dr + dg * dg + db * db;
}

function eraseConnectedRegion(
    imageData: ImageData,
    seedX: number,
    seedY: number,
    tolerance: number,
    contiguous: boolean,
): boolean {
    const { width, height, data } = imageData;
    const seedIndex = seedY * width + seedX;
    const seedOffset = seedIndex * 4;

    if (data[seedOffset + 3] === 0) {
        return false;
    }

    const seedR = data[seedOffset];
    const seedG = data[seedOffset + 1];
    const seedB = data[seedOffset + 2];

    const distance = (tolerance / 100) * 441.6729559;
    const thresholdSq = distance * distance;

    if (!contiguous) {
        let changedAny = false;
        for (let i = 0; i < width * height; i += 1) {
            const offset = i * 4;
            if (data[offset + 3] === 0) continue;
            const distSq = colorDistanceSquared(
                data[offset],
                data[offset + 1],
                data[offset + 2],
                seedR,
                seedG,
                seedB,
            );
            if (distSq <= thresholdSq) {
                data[offset + 3] = 0;
                changedAny = true;
            }
        }
        return changedAny;
    }

    const pixelCount = width * height;
    const visited = new Uint8Array(pixelCount);
    const stack: number[] = [seedIndex];
    let changed = false;

    while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited[current]) continue;
        visited[current] = 1;

        const offset = current * 4;
        if (data[offset + 3] === 0) continue;

        const distSq = colorDistanceSquared(
            data[offset],
            data[offset + 1],
            data[offset + 2],
            seedR,
            seedG,
            seedB,
        );

        if (distSq > thresholdSq) continue;

        data[offset + 3] = 0;
        changed = true;

        const x = current % width;
        const y = Math.floor(current / width);

        if (x > 0) stack.push(current - 1);
        if (x < width - 1) stack.push(current + 1);
        if (y > 0) stack.push(current - width);
        if (y < height - 1) stack.push(current + width);
    }

    return changed;
}

function eraseCircle(
    imageData: ImageData,
    centerX: number,
    centerY: number,
    radius: number,
): boolean {
    const { width, height, data } = imageData;
    const r = Math.max(1, Math.round(radius));
    const radiusSq = r * r;

    const minX = Math.max(0, centerX - r);
    const maxX = Math.min(width - 1, centerX + r);
    const minY = Math.max(0, centerY - r);
    const maxY = Math.min(height - 1, centerY + r);

    let changed = false;

    for (let y = minY; y <= maxY; y += 1) {
        const dy = y - centerY;
        for (let x = minX; x <= maxX; x += 1) {
            const dx = x - centerX;
            if (dx * dx + dy * dy > radiusSq) continue;

            const alphaOffset = (y * width + x) * 4 + 3;
            if (data[alphaOffset] !== 0) {
                data[alphaOffset] = 0;
                changed = true;
            }
        }
    }

    return changed;
}

function eraseStroke(
    imageData: ImageData,
    start: Point,
    end: Point,
    brushRadius: number,
): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const spacing = Math.max(1, brushRadius * 0.35);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    let changed = false;

    for (let i = 0; i <= steps; i += 1) {
        const t = steps === 0 ? 1 : i / steps;
        const x = Math.round(start.x + dx * t);
        const y = Math.round(start.y + dy * t);
        changed = eraseCircle(imageData, x, y, brushRadius) || changed;
    }

    return changed;
}

function pointToSegmentDistanceSquared(point: Point, start: Point, end: Point): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) {
        const distX = point.x - start.x;
        const distY = point.y - start.y;
        return distX * distX + distY * distY;
    }

    const t = Math.max(
        0,
        Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
    );
    const nearestX = start.x + dx * t;
    const nearestY = start.y + dy * t;
    const distX = point.x - nearestX;
    const distY = point.y - nearestY;
    return distX * distX + distY * distY;
}

function strokeTouchesOpaquePixels(
    imageData: ImageData,
    start: Point,
    end: Point,
    brushRadius: number,
): boolean {
    const { width, height, data } = imageData;
    const radius = Math.max(1, Math.ceil(brushRadius));
    const radiusSq = radius * radius;

    const minX = Math.max(0, Math.floor(Math.min(start.x, end.x) - radius));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(start.x, end.x) + radius));
    const minY = Math.max(0, Math.floor(Math.min(start.y, end.y) - radius));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(start.y, end.y) + radius));

    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const alphaOffset = (y * width + x) * 4 + 3;
            if (data[alphaOffset] === 0) continue;
            if (pointToSegmentDistanceSquared({ x, y }, start, end) <= radiusSq) {
                return true;
            }
        }
    }

    return false;
}

function eraseStrokeOnCanvas(
    canvas: HTMLCanvasElement,
    start: Point,
    end: Point,
    brushRadius: number,
): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, brushRadius * 2);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(start.x, start.y, brushRadius, 0, Math.PI * 2);
    ctx.fill();

    if (start.x !== end.x || start.y !== end.y) {
        ctx.beginPath();
        ctx.arc(end.x, end.y, brushRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function shouldIgnoreShortcutTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tagName = target.tagName.toLowerCase();
    return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export default function RemoveBackground() {
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const originalImageDataRef = useRef<ImageData | null>(null);
    const currentImageDataRef = useRef<ImageData | null>(null);
    const undoStackRef = useRef<ImageData[]>([]);
    const redoStackRef = useRef<ImageData[]>([]);
    const isBrushingRef = useRef(false);
    const hasStrokeChangesRef = useRef(false);
    const lastBrushPointRef = useRef<Point | null>(null);
    const brushSourceImageDataRef = useRef<ImageData | null>(null);
    const fileBaseNameRef = useRef("image");
    const lastTouchTapRef = useRef(0);
    const autoRunIdRef = useRef(0);
    const previewFrameRef = useRef<number | null>(null);

    const [mode, setMode] = useState<Mode>("auto");
    const [tolerance, setTolerance] = useState(24);
    const [brushSize, setBrushSize] = useState(24);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasImage, setHasImage] = useState(false);
    const [fileLabel, setFileLabel] = useState("");
    const [autoRemoving, setAutoRemoving] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(
        null,
    );
    const [brushPreview, setBrushPreview] = useState<BrushPreview>({
        visible: false,
        x: 0,
        y: 0,
        diameter: brushSize,
    });

    const updateHistoryButtons = useCallback(() => {
        setCanUndo(undoStackRef.current.length > 0);
        setCanRedo(redoStackRef.current.length > 0);
    }, []);

    const resetAutoState = useCallback(() => {
        setAutoRemoving(false);
    }, []);

    const drawPreview = useCallback(() => {
        const displayCanvas = displayCanvasRef.current;
        const workingCanvas = workingCanvasRef.current;
        if (!displayCanvas || !workingCanvas) return;

        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        ctx.drawImage(
            workingCanvas,
            0,
            0,
            workingCanvas.width,
            workingCanvas.height,
            0,
            0,
            displayCanvas.width,
            displayCanvas.height,
        );
    }, []);

    const schedulePreviewDraw = useCallback(() => {
        if (previewFrameRef.current !== null) return;
        previewFrameRef.current = window.requestAnimationFrame(() => {
            previewFrameRef.current = null;
            drawPreview();
        });
    }, [drawPreview]);

    useEffect(() => {
        return () => {
            if (previewFrameRef.current !== null) {
                window.cancelAnimationFrame(previewFrameRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!hasImage || !imageMeta) return;
        const displayCanvas = displayCanvasRef.current;
        if (!displayCanvas) return;

        updatePreviewCanvasSize(displayCanvas, imageMeta.width, imageMeta.height);
        drawPreview();
    }, [drawPreview, hasImage, imageMeta]);

    const applyAndRender = useCallback((imageData: ImageData) => {
        const workingCanvas = workingCanvasRef.current;
        if (!workingCanvas) return;

        const ctx = workingCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.putImageData(imageData, 0, 0);
        currentImageDataRef.current = imageData;
        drawPreview();
    }, [drawPreview]);

    const pushUndoSnapshot = useCallback(() => {
        const current = currentImageDataRef.current;
        if (!current) return;

        undoStackRef.current.push(cloneImageData(current));
        if (undoStackRef.current.length > MAX_HISTORY) {
            undoStackRef.current.shift();
        }
        redoStackRef.current = [];
        updateHistoryButtons();
    }, [updateHistoryButtons]);

    const loadFile = useCallback(async (file: File) => {
        autoRunIdRef.current += 1;
        resetAutoState();

        if (!file.type.startsWith("image/")) {
            setError("Please upload an image file.");
            return;
        }

        const objectUrl = URL.createObjectURL(file);

        try {
            const img = await loadImage(objectUrl);
            const workingCanvas = document.createElement("canvas");
            workingCanvas.width = img.naturalWidth;
            workingCanvas.height = img.naturalHeight;
            const workingCtx = workingCanvas.getContext("2d", {
                willReadFrequently: true,
            });

            if (!workingCtx) {
                throw new Error("Could not create image editor context.");
            }

            workingCtx.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
            workingCtx.drawImage(img, 0, 0);
            const source = workingCtx.getImageData(
                0,
                0,
                workingCanvas.width,
                workingCanvas.height,
            );

            workingCanvasRef.current = workingCanvas;
            originalImageDataRef.current = cloneImageData(source);
            currentImageDataRef.current = cloneImageData(source);
            undoStackRef.current = [];
            redoStackRef.current = [];
            updateHistoryButtons();

            fileBaseNameRef.current = file.name.replace(/\.[^.]+$/, "") || "image";
            setFileLabel(file.name);

            setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
            setHasImage(true);
            setError(null);
        } catch {
            setError("Could not load that image. Please try another file.");
            setHasImage(false);
            setFileLabel("");
            setImageMeta(null);
            workingCanvasRef.current = null;
            originalImageDataRef.current = null;
            currentImageDataRef.current = null;
            undoStackRef.current = [];
            redoStackRef.current = [];
            updateHistoryButtons();
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }, [resetAutoState, updateHistoryButtons]);


    const handleUndo = useCallback(() => {
        const previous = undoStackRef.current.pop();
        const current = currentImageDataRef.current;
        if (!previous || !current) return;

        redoStackRef.current.push(cloneImageData(current));
        applyAndRender(previous);
        updateHistoryButtons();
    }, [applyAndRender, updateHistoryButtons]);

    const handleRedo = useCallback(() => {
        const next = redoStackRef.current.pop();
        const current = currentImageDataRef.current;
        if (!next || !current) return;

        undoStackRef.current.push(cloneImageData(current));
        applyAndRender(next);
        updateHistoryButtons();
    }, [applyAndRender, updateHistoryButtons]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!hasImage) return;
            if (!(event.metaKey || event.ctrlKey)) return;
            if (shouldIgnoreShortcutTarget(event.target)) return;
            if (event.altKey) return;
            if (event.key.toLowerCase() !== "z") return;

            event.preventDefault();
            if (event.shiftKey) {
                handleRedo();
                return;
            }
            handleUndo();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [handleRedo, handleUndo, hasImage]);

    const handleReset = useCallback(() => {
        const original = originalImageDataRef.current;
        if (!original) return;
        const confirmed = window.confirm("Reset all edits and restore the original image?");
        if (!confirmed) return;

        applyAndRender(cloneImageData(original));
        undoStackRef.current = [];
        redoStackRef.current = [];
        updateHistoryButtons();
        setError(null);
    }, [applyAndRender, updateHistoryButtons]);

    const handleDownload = useCallback(() => {
        const workingCanvas = workingCanvasRef.current;
        if (!workingCanvas) return;

        workingCanvas.toBlob((blob) => {
            if (!blob) {
                setError("Could not export PNG.");
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${fileBaseNameRef.current}-no-bg.png`;
            link.click();
            URL.revokeObjectURL(url);
        }, "image/png");
    }, []);

    const handleAutoRemove = useCallback(async () => {
        const current = currentImageDataRef.current;
        const workingCanvas = workingCanvasRef.current;
        if (!current || !workingCanvas || autoRemoving) return;

        const runId = ++autoRunIdRef.current;
        setAutoRemoving(true);
        setError(null);

        try {
            const sourceBlob = await canvasToBlob(workingCanvas, "image/png");
            if (autoRunIdRef.current !== runId) return;

            const backgroundRemovalModule = await import("@imgly/background-removal");
            const removeBackground = (
                backgroundRemovalModule.default ?? backgroundRemovalModule.removeBackground
            ) as (image: Blob, configuration?: Record<string, unknown>) => Promise<Blob>;
            if (autoRunIdRef.current !== runId) return;

            const resultBlob = await removeBackground(sourceBlob, {
                model: "isnet_fp16",
                device: "cpu",
                rescale: true,
                output: {
                    format: "image/png",
                },
            });
            if (autoRunIdRef.current !== runId) return;

            const resultUrl = URL.createObjectURL(resultBlob);
            try {
                const resultImage = await loadImage(resultUrl);
                if (autoRunIdRef.current !== runId) return;

                const nextCanvas = document.createElement("canvas");
                nextCanvas.width = resultImage.naturalWidth;
                nextCanvas.height = resultImage.naturalHeight;
                const nextCtx = nextCanvas.getContext("2d", { willReadFrequently: true });

                if (!nextCtx) {
                    throw new Error("Could not prepare automatic cutout result.");
                }

                nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
                nextCtx.drawImage(resultImage, 0, 0);
                const nextImageData = nextCtx.getImageData(0, 0, nextCanvas.width, nextCanvas.height);

                pushUndoSnapshot();
                workingCanvasRef.current = nextCanvas;
                setImageMeta({ width: nextCanvas.width, height: nextCanvas.height });
                applyAndRender(nextImageData);
            } finally {
                URL.revokeObjectURL(resultUrl);
            }
        } catch {
            if (autoRunIdRef.current !== runId) return;
            setError("Automatic background removal failed. Try again or use the manual tools.");
        } finally {
            if (autoRunIdRef.current === runId) {
                resetAutoState();
            }
        }
    }, [applyAndRender, autoRemoving, pushUndoSnapshot, resetAutoState]);

    const runColorRemovalAtPoint = useCallback(
        (point: Point) => {
            if (autoRemoving) return;
            const current = currentImageDataRef.current;
            if (!current) return;

            const next = cloneImageData(current);
            const changed = eraseConnectedRegion(
                next,
                point.x,
                point.y,
                tolerance,
                mode === "click",
            );
            if (!changed) return;

            pushUndoSnapshot();
            applyAndRender(next);
            setError(null);
        },
        [applyAndRender, autoRemoving, mode, pushUndoSnapshot, tolerance],
    );

    const beginBrush = useCallback(
        (point: Point) => {
            if (autoRemoving) return;
            const current = currentImageDataRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!current || !workingCanvas) return;

            pushUndoSnapshot();
            brushSourceImageDataRef.current = current;

            const radius = brushSize / 2;
            const changed = strokeTouchesOpaquePixels(current, point, point, radius);
            eraseStrokeOnCanvas(workingCanvas, point, point, radius);
            schedulePreviewDraw();

            isBrushingRef.current = true;
            hasStrokeChangesRef.current = changed;
            lastBrushPointRef.current = point;
            setError(null);
        },
        [autoRemoving, brushSize, pushUndoSnapshot, schedulePreviewDraw],
    );

    const continueBrush = useCallback(
        (point: Point) => {
            if (!isBrushingRef.current) return;
            const start = lastBrushPointRef.current;
            const source = brushSourceImageDataRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!start || !source || !workingCanvas) return;

            const radius = brushSize / 2;
            if (!hasStrokeChangesRef.current && strokeTouchesOpaquePixels(source, start, point, radius)) {
                hasStrokeChangesRef.current = true;
            }

            eraseStrokeOnCanvas(workingCanvas, start, point, radius);
            schedulePreviewDraw();
            lastBrushPointRef.current = point;
        },
        [brushSize, schedulePreviewDraw],
    );

    const endBrush = useCallback(() => {
        if (!isBrushingRef.current) return;
        isBrushingRef.current = false;
        lastBrushPointRef.current = null;

        const workingCanvas = workingCanvasRef.current;
        const workingCtx = workingCanvas?.getContext("2d", { willReadFrequently: true });
        if (workingCanvas && workingCtx) {
            currentImageDataRef.current = workingCtx.getImageData(
                0,
                0,
                workingCanvas.width,
                workingCanvas.height,
            );
        }
        brushSourceImageDataRef.current = null;

        if (!hasStrokeChangesRef.current) {
            undoStackRef.current.pop();
            updateHistoryButtons();
        }
        hasStrokeChangesRef.current = false;
    }, [updateHistoryButtons]);

    const onCanvasPointerDown = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = displayCanvasRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!canvas || !workingCanvas) return;
            if (mode !== "brush") return;

            const point = getCanvasPoint(
                canvas,
                event.clientX,
                event.clientY,
                workingCanvas.width,
                workingCanvas.height,
            );
            canvas.setPointerCapture(event.pointerId);
            beginBrush(point);
        },
        [beginBrush, mode],
    );

    const onCanvasTouchStart = useCallback(
        (event: React.TouchEvent<HTMLCanvasElement>) => {
            if (mode !== "auto" && mode !== "click" && mode !== "remove-color") return;
            const touch = event.touches[0];
            if (!touch) return;

            const canvas = displayCanvasRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!canvas || !workingCanvas) return;

            event.preventDefault();
            lastTouchTapRef.current = Date.now();
            if (mode === "auto") {
                handleAutoRemove();
                return;
            }
            const point = getCanvasPoint(canvas, touch.clientX, touch.clientY, workingCanvas.width, workingCanvas.height);
            runColorRemovalAtPoint(point);
        },
        [handleAutoRemove, mode, runColorRemovalAtPoint],
    );

    const onCanvasClick = useCallback(
        (event: React.MouseEvent<HTMLCanvasElement>) => {
            if (Date.now() - lastTouchTapRef.current < 500) return;

            const canvas = displayCanvasRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!canvas || !workingCanvas) return;

            if (mode === "auto") {
                handleAutoRemove();
                return;
            }
            if (mode !== "click" && mode !== "remove-color") return;

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, workingCanvas.width, workingCanvas.height);
            runColorRemovalAtPoint(point);
        },
        [handleAutoRemove, mode, runColorRemovalAtPoint],
    );

    const updateBrushPreviewFromPointer = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (mode !== "brush") return;
            const canvas = displayCanvasRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!canvas || !workingCanvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = clamp(event.clientX - rect.left, 0, rect.width);
            const y = clamp(event.clientY - rect.top, 0, rect.height);
            const diameter = Math.max(2, brushSize * (rect.width / workingCanvas.width));

            setBrushPreview({
                visible: true,
                x,
                y,
                diameter,
            });
        },
        [brushSize, mode],
    );

    const onCanvasPointerMove = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (mode !== "brush") return;
            updateBrushPreviewFromPointer(event);
            if (!isBrushingRef.current) return;

            const canvas = displayCanvasRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!canvas || !workingCanvas) return;

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, workingCanvas.width, workingCanvas.height);
            continueBrush(point);
        },
        [continueBrush, mode, updateBrushPreviewFromPointer],
    );

    const onCanvasPointerUp = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (mode !== "brush") return;
            const canvas = displayCanvasRef.current;
            if (canvas?.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
            endBrush();
        },
        [endBrush, mode],
    );

    const onCanvasPointerLeave = useCallback(() => {
        if (mode === "brush") {
            setBrushPreview((prev) => ({ ...prev, visible: false }));
            endBrush();
        }
    }, [endBrush, mode]);

    const onCanvasPointerEnter = useCallback(
        (event: React.PointerEvent<HTMLCanvasElement>) => {
            if (mode !== "brush") return;
            updateBrushPreviewFromPointer(event);
        },
        [mode, updateBrushPreviewFromPointer],
    );

    useEffect(() => {
        if (mode !== "brush") {
            setBrushPreview((prev) => ({ ...prev, visible: false }));
        }
    }, [mode]);

    const modeHint = useMemo(() => {
        if (mode === "auto") {
            return "Click the button to auto remove the background. Runs entirely in your browser.";
        }
        if (mode === "click") {
            return "Tap a region to remove connected pixels.";
        }
        if (mode === "remove-color") {
            return "Tap a color to remove similar shades across the whole image.";
        }
        return "Click and drag to erase pixels with the brush.";
    }, [mode]);

    return (
        <div className="ui-stack">
            <style>{AUTO_REMOVE_ANIMATIONS}</style>
            <ImageInput
                onFile={loadFile}
                dragging={dragging}
                onDraggingChange={setDragging}
                accept="image/*"
                formats={["PNG", "JPG", "WebP"]}
                fileName={fileLabel || null}
            />

            <ErrorMessage message={error} />

            {hasImage && imageMeta && (
                <>
                    <div className="ui-panel ui-stack">
                        <div className="ui-action-bar ui-action-bar--split">
                            <div className="ui-segmented" role="group" aria-label="Removal mode">
                                <button
                                    className="ui-button"
                                    type="button"
                                    onClick={() => setMode("auto")}
                                    disabled={autoRemoving}
                                    aria-pressed={mode === "auto"}
                                >
                                    Auto Remove
                                </button>
                                <button
                                    className="ui-button"
                                    type="button"
                                    onClick={() => setMode("click")}
                                    disabled={autoRemoving}
                                    aria-pressed={mode === "click"}
                                >
                                    Area Remove
                                </button>
                                <button
                                    className="ui-button"
                                    type="button"
                                    onClick={() => setMode("remove-color")}
                                    disabled={autoRemoving}
                                    aria-pressed={mode === "remove-color"}
                                >
                                    Color Remove
                                </button>
                                <button
                                    className="ui-button"
                                    type="button"
                                    onClick={() => setMode("brush")}
                                    disabled={autoRemoving}
                                    aria-pressed={mode === "brush"}
                                >
                                    Brush Erase
                                </button>
                            </div>
                            <div className="ui-action-bar">
                                <button className="ui-button" data-variant="secondary" type="button" onClick={handleUndo} disabled={!canUndo}>Undo</button>
                                <button className="ui-button" data-variant="secondary" type="button" onClick={handleRedo} disabled={!canRedo}>Redo</button>
                                <button className="ui-button" data-variant="danger" type="button" onClick={handleReset} disabled={autoRemoving}>Reset</button>
                            </div>
                        </div>

                            <p className="ui-hint">{modeHint}</p>

                            <div className="ui-grid">
                                {mode === "auto" && (
                                    <div className="ui-field">
                                        <button
                                            className="ui-button"
                                            type="button"
                                            onClick={handleAutoRemove}
                                            disabled={autoRemoving}
                                        >
                                            {autoRemoving ? "Removing background…" : "Remove Background"}
                                        </button>
                                    </div>
                                )}
                                {(mode === "click" || mode === "remove-color") && (
                                    <div className="ui-field">
                                        <label className="ui-field">
                                            <span className="ui-label">Tolerance: {tolerance}</span>
                                            <span className="ui-hint">
                                                Higher tolerance removes more shades near your clicked color.
                                            </span>
                                            <input
                                                className="ui-range"
                                                type="range"
                                                min={0}
                                                max={100}
                                                value={tolerance}
                                                onChange={(event) =>
                                                    setTolerance(Number(event.currentTarget.value))
                                                }
                                            />
                                        </label>
                                    </div>
                                )}

                                {mode === "brush" && (
                                    <label className="ui-field">
                                        <span className="ui-label">Brush size: {brushSize}px</span>
                                        <input
                                            className="ui-range"
                                            type="range"
                                            min={2}
                                            max={240}
                                            value={brushSize}
                                            onChange={(event) =>
                                                setBrushSize(Number(event.currentTarget.value))
                                            }
                                        />
                                    </label>
                                )}
                            </div>
                    </div>

                    <div className="ui-panel ui-stack" data-variant="inset">
                        <div style={styles.canvasWrap}>
                            <canvas
                                ref={displayCanvasRef}
                                onPointerDown={onCanvasPointerDown}
                                onPointerMove={onCanvasPointerMove}
                                onPointerUp={onCanvasPointerUp}
                                onPointerCancel={onCanvasPointerUp}
                                onPointerLeave={onCanvasPointerLeave}
                                onPointerEnter={onCanvasPointerEnter}
                                onTouchStart={onCanvasTouchStart}
                                onClick={onCanvasClick}
                                style={styles.canvas(mode)}
                            />
                            {autoRemoving && (
                                <div style={styles.autoOverlay}>
                                    <div style={styles.autoOverlaySweep} />
                                    <div style={styles.autoOverlayCard}>
                                        <div style={styles.autoOverlaySpinner}>
                                            <Spinner size={26} color="#ffffff" />
                                        </div>
                                        <strong style={styles.autoOverlayTitle}>
                                            Removing background
                                        </strong>
                                        <span style={styles.autoOverlaySubtext}>
                                            This may take a minute…
                                        </span>
                                    </div>
                                </div>
                            )}
                            {mode === "brush" && brushPreview.visible && (
                                <div style={styles.brushPreview(brushPreview)} />
                            )}
                        </div>
                        <div className="ui-action-bar ui-action-bar--center">
                            <DownloadButton
                                onClick={handleDownload}
                                filename="image-no-bg.png"
                                label="Download PNG"
                                disabled={autoRemoving}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const styles = {
    canvasWrap: {
        width: "fit-content",
        maxWidth: "100%",
        margin: "0 auto",
        position: "relative",
        background:
            "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 18px 18px",
        border: "1px solid #dbe2ea",
        lineHeight: 0,
    } satisfies CSSProperties,
    canvas: (mode: Mode): CSSProperties => ({
        display: "block",
        maxWidth: "100%",
        cursor: mode === "brush" ? "none" : mode === "auto" ? "pointer" : "crosshair",
        touchAction: "none",
    }),
    autoOverlay: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "rgba(15, 23, 42, 0.38)",
        backdropFilter: "blur(1.5px)",
        pointerEvents: "auto",
        animation: "remove-background-overlay-pulse 1.8s ease-in-out infinite",
    } satisfies CSSProperties,
    autoOverlaySweep: {
        position: "absolute",
        inset: "-20%",
        background:
            "linear-gradient(100deg, rgba(255,255,255,0) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0) 75%)",
        animation: "remove-background-overlay-sweep 1.8s ease-in-out infinite",
    } satisfies CSSProperties,
    autoOverlayCard: {
        position: "relative",
        zIndex: 1,
        minWidth: "min(320px, calc(100% - 2rem))",
        maxWidth: "calc(100% - 2rem)",
        padding: "1rem 1.1rem",
        borderRadius: "14px",
        background: "rgba(15, 23, 42, 0.82)",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        boxShadow: "0 18px 44px rgba(15, 23, 42, 0.24)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.55rem",
        textAlign: "center",
        color: "#f8fafc",
    } satisfies CSSProperties,
    autoOverlaySpinner: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "44px",
        height: "44px",
        borderRadius: "9999px",
        background: "rgba(255, 255, 255, 0.08)",
    } satisfies CSSProperties,
    autoOverlayTitle: {
        fontSize: "1rem",
        lineHeight: 1.2,
    } satisfies CSSProperties,
    autoOverlayText: {
        fontSize: "0.92rem",
        color: "rgba(248, 250, 252, 0.92)",
    } satisfies CSSProperties,
    autoOverlaySubtext: {
        fontSize: "0.8rem",
        color: "rgba(226, 232, 240, 0.82)",
        marginBottom: "1rem",
    } satisfies CSSProperties,
    brushPreview: (brushPreview: BrushPreview): CSSProperties => ({
        position: "absolute",
        left: `${brushPreview.x}px`,
        top: `${brushPreview.y}px`,
        width: `${brushPreview.diameter}px`,
        height: `${brushPreview.diameter}px`,
        transform: "translate(-50%, -50%)",
        border: "1px solid #111827",
        borderRadius: "9999px",
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.8)",
        pointerEvents: "none",
    }),
};
