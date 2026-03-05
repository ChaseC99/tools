import { useCallback, useEffect, useRef, useState } from "react";
import { loadImage, canvasToBlob, decodeHeic, cloneImageData } from "@tools/shared/imageUtils";
import ImageDropZone from "@tools/shared/ImageDropZone";
import ErrorMessage from "@tools/shared/ErrorMessage";
import DownloadButton from "@tools/shared/DownloadButton";
import Spinner from "@tools/shared/Spinner";
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
            <div style={styles.container}>
                <ImageDropZone
                    onFile={handleFile}
                    dragging={dragging}
                    onDraggingChange={setDragging}
                    accept="image/jpeg,image/png,image/webp,image/gif,.heic,.heif"
                >
                    {processing ? (
                        <div style={styles.spinnerWrap}>
                            <Spinner size={28} color="#4a90d9" />
                            <p style={{ margin: 0, color: "#666" }}>Loading image...</p>
                        </div>
                    ) : (
                        <div>
                            <p style={{ margin: 0, fontSize: "1.1rem", color: "#333" }}>
                                Drop an image here or click to upload
                            </p>
                            <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#999" }}>
                                JPG, PNG, WebP, GIF, HEIC
                            </p>
                        </div>
                    )}
                </ImageDropZone>
                <ErrorMessage message={error} />
                <p style={styles.note}>All processing happens in your browser. Images are never uploaded.</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <canvas
                ref={previewCanvasRef}
                style={styles.canvas}
            />

            <div style={styles.grid}>
                <button
                    type="button"
                    style={{
                        ...styles.thumbBtn,
                        borderColor: activeFilter === null ? "#4a90d9" : "#d1d5db",
                        borderWidth: activeFilter === null ? 2 : 1,
                    }}
                    onClick={() => handleFilterSelect(null)}
                >
                    {thumbnails.get("original") ? (
                        <img src={thumbnails.get("original")} alt="Original" style={styles.thumbImg} />
                    ) : (
                        <div style={styles.thumbPlaceholder} />
                    )}
                    <span style={styles.thumbLabel}>Original</span>
                </button>
                {FILTERS.map((filter) => (
                    <button
                        key={filter.id}
                        type="button"
                        style={{
                            ...styles.thumbBtn,
                            borderColor: activeFilter === filter.id ? "#4a90d9" : "#d1d5db",
                            borderWidth: activeFilter === filter.id ? 2 : 1,
                        }}
                        onClick={() => handleFilterSelect(filter.id)}
                    >
                        {thumbnails.get(filter.id) ? (
                            <img src={thumbnails.get(filter.id)} alt={filter.label} style={styles.thumbImg} />
                        ) : (
                            <div style={styles.thumbPlaceholder} />
                        )}
                        <span style={styles.thumbLabel}>{filter.label}</span>
                    </button>
                ))}
            </div>

            {activeConfig?.hasSlider && (
                <div style={styles.sliderWrap}>
                    <label style={styles.sliderLabel}>
                        {activeConfig.sliderLabel}: {sliderValue}
                    </label>
                    <input
                        type="range"
                        min={activeConfig.sliderMin}
                        max={activeConfig.sliderMax}
                        value={sliderValue}
                        onChange={(e) => setSliderValue(Number(e.target.value))}
                        style={styles.slider}
                    />
                </div>
            )}

            <div style={styles.actions}>
                <DownloadButton
                    filename="filtered-image.png"
                    onClick={handleDownload}
                    disabled={processing}
                    label={processing ? "Processing..." : "Download PNG"}
                />
<button type="button" onClick={handleReplace} style={styles.btn}>
                    Replace Image
                </button>
            </div>

            <ErrorMessage message={error} />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: "24px 20px",
        maxWidth: "800px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    canvas: {
        maxWidth: "100%",
        height: "auto",
        borderRadius: "8px",
        border: "1px solid #d1d5db",
        display: "block",
        margin: "0 auto",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
        gap: "8px",
    },
    thumbBtn: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        padding: "6px",
        borderRadius: "8px",
        borderStyle: "solid",
        background: "#fff",
        cursor: "pointer",
        transition: "border-color 0.15s",
    },
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
        background: "#f3f4f6",
        borderRadius: "4px",
    },
    thumbLabel: {
        fontSize: "11px",
        color: "#555",
        textAlign: "center",
        lineHeight: "1.2",
    },
    sliderWrap: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    sliderLabel: {
        fontSize: "14px",
        color: "#333",
        fontWeight: 500,
    },
    slider: {
        width: "100%",
        cursor: "pointer",
    },
    actions: {
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        alignItems: "center",
    },
    btn: {
        padding: "8px 20px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        background: "#fff",
        cursor: "pointer",
        fontSize: "14px",
    },
    spinnerWrap: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
    },
    note: {
        margin: 0,
        fontSize: "0.8rem",
        color: "#999",
        textAlign: "center",
    },
};
