import { useCallback, useEffect, useRef, useState } from "react";
import { loadImage, canvasToBlob, decodeHeic, cloneImageData } from "@tools/shared/imageUtils";
import ImageInput from "@tools/shared/ImageInput";
import ErrorMessage from "@tools/shared/ErrorMessage";
import DownloadButton from "@tools/shared/DownloadButton";
import { FILTERS, applyFilter, type FilterId } from "./filters";

const THUMB_MAX = 80;
const DISPLAY_MAX = 720;
const FULL_MAX = 4000;

function resizeToCanvas(img: HTMLImageElement, maxEdge: number): ImageData {
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

function imageDataToDataUrl(data: ImageData): string {
    const canvas = document.createElement("canvas");
    canvas.width = data.width;
    canvas.height = data.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL();
}

export default function ImageFilter() {
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterId | null>(null);
    const [sliderValue, setSliderValue] = useState(0);
    const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());

    const originalDataRef = useRef<ImageData | null>(null);
    const displayDataRef = useRef<ImageData | null>(null);
    const thumbnailSourceRef = useRef<ImageData | null>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    const renderToCanvas = useCallback((data: ImageData) => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        canvas.width = data.width;
        canvas.height = data.height;
        const ctx = canvas.getContext("2d")!;
        ctx.putImageData(data, 0, 0);
    }, []);

    const handleFile = useCallback(async (f: File) => {
        setError(null);
        setProcessing(true);
        setActiveFilter(null);
        setSliderValue(0);
        setThumbnails(new Map());

        try {
            let blob: Blob = f;
            if (f.name.toLowerCase().endsWith(".heic") || f.name.toLowerCase().endsWith(".heif")) {
                blob = await decodeHeic(f);
            }

            const url = URL.createObjectURL(blob);
            const img = await loadImage(url);
            URL.revokeObjectURL(url);

            const fullData = resizeToCanvas(img, FULL_MAX);
            const displayData = resizeToCanvas(img, DISPLAY_MAX);
            const thumbData = resizeToCanvas(img, THUMB_MAX);

            originalDataRef.current = fullData;
            displayDataRef.current = displayData;
            thumbnailSourceRef.current = thumbData;

            setFile(f);
            renderToCanvas(displayData);

            // Generate thumbnails
            const thumbMap = new Map<string, string>();
            thumbMap.set("original", imageDataToDataUrl(thumbData));
            for (const filter of FILTERS) {
                const filtered = applyFilter(thumbData, filter.id, filter.sliderDefault);
                thumbMap.set(filter.id, imageDataToDataUrl(filtered));
            }
            setThumbnails(thumbMap);
        } catch {
            setError("Failed to load image. Please try a different file.");
        } finally {
            setProcessing(false);
        }
    }, [renderToCanvas]);

    // Apply filter on display canvas when filter or slider changes
    useEffect(() => {
        if (!displayDataRef.current || !file) return;
        if (!activeFilter) {
            renderToCanvas(displayDataRef.current);
            return;
        }
        const filtered = applyFilter(displayDataRef.current, activeFilter, sliderValue);
        renderToCanvas(filtered);
    }, [file, activeFilter, sliderValue, renderToCanvas]);

    const handleFilterSelect = useCallback((filterId: FilterId | null) => {
        setActiveFilter(filterId);
        if (filterId) {
            const config = FILTERS.find((f) => f.id === filterId);
            if (config) setSliderValue(config.sliderDefault);
        }
    }, []);

    const handleDownload = useCallback(async () => {
        if (!originalDataRef.current) return;
        setProcessing(true);
        try {
            let data: ImageData;
            if (activeFilter) {
                data = applyFilter(originalDataRef.current, activeFilter, sliderValue);
            } else {
                data = cloneImageData(originalDataRef.current);
            }
            const canvas = document.createElement("canvas");
            canvas.width = data.width;
            canvas.height = data.height;
            const ctx = canvas.getContext("2d")!;
            ctx.putImageData(data, 0, 0);
            const blob = await canvasToBlob(canvas, "image/png");
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `filtered-image.png`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError("Failed to generate download.");
        } finally {
            setProcessing(false);
        }
    }, [activeFilter, sliderValue]);

    const handleReplace = useCallback(() => {
        setFile(null);
        setActiveFilter(null);
        setSliderValue(0);
        setThumbnails(new Map());
        setError(null);
        originalDataRef.current = null;
        displayDataRef.current = null;
        thumbnailSourceRef.current = null;
    }, []);

    const activeConfig = activeFilter ? FILTERS.find((f) => f.id === activeFilter) : null;

    if (!file) {
        return (
            <div className="ui-stack">
                <ImageInput
                    onFile={handleFile}
                    dragging={dragging}
                    onDraggingChange={setDragging}
                    accept="image/jpeg,image/png,image/webp,image/gif,.heic,.heif"
                    formats={["JPG", "PNG", "WebP", "GIF", "HEIC"]}
                    loading={processing}
                    loadingLabel="Preparing your image…"
                />
                <ErrorMessage message={error} />
                <p className="ui-hint" style={{ margin: 0, textAlign: "center" }}>
                    Preview and adjust filters locally. Images are never uploaded.
                </p>
            </div>
        );
    }

    return (
        <div className="ui-stack">
            <canvas
                ref={previewCanvasRef}
                className="ui-media-preview"
            />

            <div className="ui-selectable-grid">
                <button
                    type="button"
                    className="ui-selectable-card"
                    aria-pressed={activeFilter === null}
                    onClick={() => handleFilterSelect(null)}
                >
                    {thumbnails.get("original") ? (
                        <img src={thumbnails.get("original")} alt="Original" style={styles.thumbImg} />
                    ) : (
                        <div style={styles.thumbPlaceholder} />
                    )}
                    <span className="ui-stat-label">Original</span>
                </button>
                {FILTERS.map((filter) => (
                    <button
                        key={filter.id}
                        type="button"
                        className="ui-selectable-card"
                        aria-pressed={activeFilter === filter.id}
                        onClick={() => handleFilterSelect(filter.id)}
                    >
                        {thumbnails.get(filter.id) ? (
                            <img src={thumbnails.get(filter.id)} alt={filter.label} style={styles.thumbImg} />
                        ) : (
                            <div style={styles.thumbPlaceholder} />
                        )}
                        <span className="ui-stat-label">{filter.label}</span>
                    </button>
                ))}
            </div>

            {activeConfig?.hasSlider && (
                <label className="ui-field">
                    <span className="ui-label">
                        {activeConfig.sliderLabel}: {sliderValue}
                    </span>
                    <input
                        className="ui-range"
                        type="range"
                        min={activeConfig.sliderMin}
                        max={activeConfig.sliderMax}
                        value={sliderValue}
                        onChange={(e) => setSliderValue(Number(e.target.value))}
                    />
                </label>
            )}

            <div className="ui-action-bar">
                <DownloadButton
                    filename="filtered-image.png"
                    onClick={handleDownload}
                    disabled={processing}
                    label={processing ? "Processing..." : "Download PNG"}
                />
                <button className="ui-button" data-variant="secondary" type="button" onClick={handleReplace}>
                    Replace Image
                </button>
            </div>

            <ErrorMessage message={error} />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    thumbImg: {
        width: "100%",
        aspectRatio: "1",
        objectFit: "cover",
        borderRadius: "4px",
        display: "block",
    },
    thumbPlaceholder: {
        width: "100%",
        aspectRatio: "1",
        background: "var(--ui-color-surface-inset)",
        borderRadius: "var(--ui-radius-sm)",
    },
};
