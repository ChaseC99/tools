import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { clamp, cloneImageData, loadImage } from "@tools/shared/imageUtils";
import ImageDropZone from "@tools/shared/ImageDropZone";
import ErrorMessage from "@tools/shared/ErrorMessage";
import DownloadButton from "@tools/shared/DownloadButton";

type Mode = "click" | "remove-color" | "brush";

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
    const fileBaseNameRef = useRef("image");
    const lastTouchTapRef = useRef(0);

    const [mode, setMode] = useState<Mode>("click");
    const [tolerance, setTolerance] = useState(24);
    const [brushSize, setBrushSize] = useState(24);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasImage, setHasImage] = useState(false);
    const [fileLabel, setFileLabel] = useState("");
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
    }, [updateHistoryButtons]);


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

    const runColorRemovalAtPoint = useCallback(
        (point: Point) => {
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
        [applyAndRender, mode, pushUndoSnapshot, tolerance],
    );

    const beginBrush = useCallback(
        (point: Point) => {
            const current = currentImageDataRef.current;
            if (!current) return;

            pushUndoSnapshot();
            const changed = eraseCircle(current, point.x, point.y, brushSize / 2);
            applyAndRender(current);

            isBrushingRef.current = true;
            hasStrokeChangesRef.current = changed;
            lastBrushPointRef.current = point;
            setError(null);
        },
        [applyAndRender, brushSize, pushUndoSnapshot],
    );

    const continueBrush = useCallback(
        (point: Point) => {
            if (!isBrushingRef.current) return;
            const current = currentImageDataRef.current;
            const start = lastBrushPointRef.current;
            if (!current || !start) return;

            const changed = eraseStroke(current, start, point, brushSize / 2);
            if (changed) {
                hasStrokeChangesRef.current = true;
            }
            applyAndRender(current);
            lastBrushPointRef.current = point;
        },
        [applyAndRender, brushSize],
    );

    const endBrush = useCallback(() => {
        if (!isBrushingRef.current) return;
        isBrushingRef.current = false;
        lastBrushPointRef.current = null;

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

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, workingCanvas.width, workingCanvas.height);

            if (mode === "click" || mode === "remove-color") {
                runColorRemovalAtPoint(point);
                return;
            }

            canvas.setPointerCapture(event.pointerId);
            beginBrush(point);
        },
        [beginBrush, mode, runColorRemovalAtPoint],
    );

    const onCanvasTouchStart = useCallback(
        (event: React.TouchEvent<HTMLCanvasElement>) => {
            if (mode !== "click" && mode !== "remove-color") return;
            const touch = event.touches[0];
            if (!touch) return;

            const canvas = displayCanvasRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!canvas || !workingCanvas) return;

            event.preventDefault();
            lastTouchTapRef.current = Date.now();
            const point = getCanvasPoint(canvas, touch.clientX, touch.clientY, workingCanvas.width, workingCanvas.height);
            runColorRemovalAtPoint(point);
        },
        [mode, runColorRemovalAtPoint],
    );

    const onCanvasClick = useCallback(
        (event: React.MouseEvent<HTMLCanvasElement>) => {
            if (mode !== "click" && mode !== "remove-color") return;
            if (Date.now() - lastTouchTapRef.current < 500) return;

            const canvas = displayCanvasRef.current;
            const workingCanvas = workingCanvasRef.current;
            if (!canvas || !workingCanvas) return;

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, workingCanvas.width, workingCanvas.height);
            runColorRemovalAtPoint(point);
        },
        [mode, runColorRemovalAtPoint],
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
        if (mode === "click") {
            return "Tap a region to remove connected pixels.";
        }
        if (mode === "remove-color") {
            return "Tap a color to remove similar shades across the whole image.";
        }
        return "Click and drag to erase pixels with the brush.";
    }, [mode]);

    return (
        <div style={styles.pageContainer}>
            <ImageDropZone
                onFile={loadFile}
                dragging={dragging}
                onDraggingChange={setDragging}
                accept="image/*"
                theme="light"
            >
                {!hasImage ? (
                    <>
                        <strong>Drop an image here or click to upload</strong>
                        <p style={styles.uploadHint}>
                            Supports PNG, JPG, WebP, and other browser-decodable image types
                        </p>
                    </>
                ) : (
                    <div style={styles.loadedRow}>
                        <span style={styles.loadedRowTextWrap}>
                            <strong style={styles.loadedFileName} title={fileLabel}>
                                {fileLabel}
                            </strong>
                            <span style={styles.loadedDimensions}>
                                • {imageMeta.width} x {imageMeta.height}
                            </span>
                        </span>
                        <button
                            type="button"
                            style={styles.replaceImageButton}
                        >
                            Replace Image
                        </button>
                    </div>
                )}
            </ImageDropZone>

            <ErrorMessage message={error} theme="light" />

            {hasImage && imageMeta && (
                <>
                    <div style={styles.toolbarRow}>
                        <div style={styles.leftControlColumn}>
                            <div style={styles.modeButtonsRow}>
                                <button
                                    type="button"
                                    onClick={() => setMode("click")}
                                    style={styles.modeButton(mode === "click")}
                                >
                                    Smart Remove
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode("remove-color")}
                                    style={styles.modeButton(mode === "remove-color")}
                                >
                                    Color Remove
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode("brush")}
                                    style={styles.modeButton(mode === "brush")}
                                >
                                    Brush Erase
                                </button>
                            </div>

                            <p style={styles.modeHint}>{modeHint}</p>

                            <div style={styles.sliderGrid}>
                                {(mode === "click" || mode === "remove-color") && (
                                    <div style={styles.sliderGroup}>
                                        <label style={styles.sliderLabel}>
                                            <span>Tolerance: {tolerance}</span>
                                            <span style={styles.toleranceHint}>
                                                Higher tolerance removes more shades near your clicked color.
                                            </span>
                                            <input
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
                                    <label style={styles.sliderLabel}>
                                        <span>Brush Size: {brushSize}px</span>
                                        <input
                                            type="range"
                                            min={2}
                                            max={120}
                                            value={brushSize}
                                            onChange={(event) =>
                                                setBrushSize(Number(event.currentTarget.value))
                                            }
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div style={styles.actionsRow}>
                            <button
                                type="button"
                                onClick={handleUndo}
                                disabled={!canUndo}
                                style={styles.secondaryActionButton(!canUndo)}
                            >
                                Undo
                            </button>
                            <button
                                type="button"
                                onClick={handleRedo}
                                disabled={!canRedo}
                                style={styles.secondaryActionButton(!canRedo)}
                            >
                                Redo
                            </button>
                            <button
                                type="button"
                                onClick={handleReset}
                                style={styles.resetButton}
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div style={styles.canvasCard}>
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
                            {mode === "brush" && brushPreview.visible && (
                                <div style={styles.brushPreview(brushPreview)} />
                            )}
                        </div>
                        <div style={styles.downloadRow}>
                            <DownloadButton
                                onClick={handleDownload}
                                filename="image-no-bg.png"
                                label="Download PNG"
                                theme="light"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const styles = {
    pageContainer: {
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "0.75rem 1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
    } satisfies CSSProperties,
    uploadHint: {
        margin: "0.5rem 0 0",
        color: "#475569",
    } satisfies CSSProperties,
    loadedRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.75rem",
        textAlign: "left",
    } satisfies CSSProperties,
    loadedRowTextWrap: {
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        minWidth: 0,
        flex: 1,
    } satisfies CSSProperties,
    loadedFileName: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        display: "inline-block",
    } satisfies CSSProperties,
    loadedDimensions: {
        whiteSpace: "nowrap",
        flexShrink: 0,
    } satisfies CSSProperties,
    replaceImageButton: {
        padding: "0.5rem 0.75rem",
        borderRadius: "8px",
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#0f172a",
        cursor: "pointer",
        flexShrink: 0,
    } satisfies CSSProperties,
    toolbarRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        alignItems: "flex-start",
        justifyContent: "space-between",
    } satisfies CSSProperties,
    leftControlColumn: {
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
    } satisfies CSSProperties,
    modeButtonsRow: {
        display: "flex",
        gap: "0.5rem",
        flexWrap: "wrap",
    } satisfies CSSProperties,
    modeButton: (active: boolean): CSSProperties => ({
        padding: "0.55rem 0.8rem",
        borderRadius: "8px",
        border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
        background: active ? "#dbeafe" : "#fff",
        color: "#0f172a",
        cursor: "pointer",
    }),
    modeHint: {
        color: "#64748b",
        fontSize: "0.8rem",
        marginTop: 0,
    } satisfies CSSProperties,
    sliderGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "0.75rem",
        alignItems: "end",
    } satisfies CSSProperties,
    sliderGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
    } satisfies CSSProperties,
    sliderLabel: {
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
    } satisfies CSSProperties,
    toleranceHint: {
        color: "#64748b",
        fontSize: "0.8rem",
    } satisfies CSSProperties,
    actionsRow: {
        display: "flex",
        gap: "0.5rem",
        flexWrap: "wrap",
        alignItems: "center",
    } satisfies CSSProperties,
    secondaryActionButton: (disabled: boolean): CSSProperties => ({
        padding: "0.55rem 0.8rem",
        borderRadius: "8px",
        border: "1px solid #cbd5e1",
        background: disabled ? "#f1f5f9" : "#fff",
        color: disabled ? "#94a3b8" : "#0f172a",
        cursor: disabled ? "not-allowed" : "pointer",
    }),
    resetButton: {
        padding: "0.55rem 0.8rem",
        borderRadius: "8px",
        border: "1px solid #fecaca",
        background: "#fff1f2",
        color: "#b91c1c",
        cursor: "pointer",
    } satisfies CSSProperties,
    canvasCard: {
        border: "1px solid #cbd5e1",
        padding: "0.75rem",
        overflow: "auto",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
    } satisfies CSSProperties,
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
        cursor: mode === "brush" ? "none" : "crosshair",
        touchAction: "none",
    }),
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
    downloadRow: {
        display: "flex",
        justifyContent: "center",
    } satisfies CSSProperties,
};
