import { useState, useRef, useCallback, useEffect } from "react";
import ImageDropZone from "@tools/shared/ImageDropZone.tsx";
import DownloadButton from "@tools/shared/DownloadButton.tsx";
import ErrorMessage from "@tools/shared/ErrorMessage.tsx";
import Spinner from "@tools/shared/Spinner.tsx";
import { loadImage, decodeHeic } from "@tools/shared/imageUtils.ts";
import { extractPalette, type RGB } from "./medianCut.ts";

type ColorFormat = "hex" | "rgb" | "hsl";

function rgbToHex([r, g, b]: RGB): string {
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, Math.round(l * 100)];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function formatColor(rgb: RGB, format: ColorFormat): string {
    if (format === "hex") return rgbToHex(rgb);
    if (format === "rgb") return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    const [h, s, l] = rgbToHsl(rgb);
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function getContrastColor(rgb: RGB): string {
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return lum > 140 ? "#000000" : "#ffffff";
}

export default function ColorPalette() {
    const [file, setFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [palette, setPalette] = useState<RGB[]>([]);
    const [paletteSize, setPaletteSize] = useState(5);
    const [colorFormat, setColorFormat] = useState<ColorFormat>("hex");
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [palettePngUrl, setPalettePngUrl] = useState<string | null>(null);

    const analysisDataRef = useRef<ImageData | null>(null);
    const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const generatePalettePng = useCallback((colors: RGB[]) => {
        const blockW = 200, blockH = 200, labelH = 40;
        const canvas = document.createElement("canvas");
        canvas.width = blockW * colors.length;
        canvas.height = blockH + labelH;
        const ctx = canvas.getContext("2d")!;

        colors.forEach((rgb, i) => {
            const x = i * blockW;
            ctx.fillStyle = rgbToHex(rgb);
            ctx.fillRect(x, 0, blockW, blockH);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x, blockH, blockW, labelH);
            ctx.fillStyle = "#333333";
            ctx.font = "bold 16px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(rgbToHex(rgb), x + blockW / 2, blockH + labelH / 2);
        });

        return canvas.toDataURL("image/png");
    }, []);

    const runExtraction = useCallback(
        (data: ImageData, count: number) => {
            const colors = extractPalette(data, count);
            setPalette(colors);
            setPalettePngUrl(generatePalettePng(colors));
        },
        [generatePalettePng],
    );

    const handleFile = useCallback(
        async (f: File) => {
            setFile(f);
            setError(null);
            setPalette([]);
            setPalettePngUrl(null);
            analysisDataRef.current = null;

            if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);

            setProcessing(true);
            try {
                const ext = f.name.toLowerCase().split(".").pop() ?? "";
                const isHeic = ext === "heic" || ext === "heif" || f.type === "image/heic" || f.type === "image/heif";
                let sourceBlob: Blob = f;
                if (isHeic) {
                    try {
                        sourceBlob = await decodeHeic(f);
                    } catch (e) {
                        console.error("HEIC decode error:", e);
                        setError("Could not decode HEIC file. Try converting to JPG or PNG first.");
                        setProcessing(false);
                        return;
                    }
                }

                const previewUrl = URL.createObjectURL(sourceBlob);
                setImagePreviewUrl(previewUrl);

                const img = await loadImage(previewUrl);

                const maxDim = 200;
                let w = img.naturalWidth, h = img.naturalHeight;
                if (w > maxDim || h > maxDim) {
                    const scale = Math.min(maxDim / w, maxDim / h);
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                }

                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, w, h);
                const data = ctx.getImageData(0, 0, w, h);
                analysisDataRef.current = data;

                runExtraction(data, paletteSize);
            } catch {
                setError("Failed to load image. Please try a different file.");
            } finally {
                setProcessing(false);
            }
        },
        [imagePreviewUrl, paletteSize, runExtraction],
    );

    const handleSliderChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const count = Number(e.target.value);
            setPaletteSize(count);
            if (analysisDataRef.current) {
                runExtraction(analysisDataRef.current, count);
            }
        },
        [runExtraction],
    );

    const handleCopy = useCallback(
        (index: number) => {
            const text = formatColor(palette[index], colorFormat);
            navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
            copiedTimeoutRef.current = setTimeout(() => setCopiedIndex(null), 1500);
        },
        [palette, colorFormat],
    );

    const handleCopyCss = useCallback(() => {
        const lines = palette.map(
            (rgb, i) => `  --palette-${i + 1}: ${formatColor(rgb, colorFormat)};`,
        );
        const css = `:root {\n${lines.join("\n")}\n}`;
        navigator.clipboard.writeText(css);
    }, [palette, colorFormat]);

    useEffect(() => {
        return () => {
            if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        };
    }, [imagePreviewUrl]);

    const formats: ColorFormat[] = ["hex", "rgb", "hsl"];

    return (
        <div style={styles.container}>
            {/* Upload */}
            {!file ? (
                <ImageDropZone onFile={handleFile} dragging={dragging} onDraggingChange={setDragging} accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.heic,.heif">
                    <p style={styles.dropText}>Drop an image here or click to upload</p>
                    <p style={styles.dropSubtext}>PNG, JPG, WebP, GIF, SVG, HEIC</p>
                </ImageDropZone>
            ) : (
                <div style={styles.fileRow}>
                    <span style={styles.fileName}>{file.name}</span>
                    <button
                        type="button"
                        style={styles.replaceBtn}
                        onClick={() => {
                            setFile(null);
                            setPalette([]);
                            setPalettePngUrl(null);
                            analysisDataRef.current = null;
                            if (imagePreviewUrl) {
                                URL.revokeObjectURL(imagePreviewUrl);
                                setImagePreviewUrl(null);
                            }
                        }}
                    >
                        Replace
                    </button>
                </div>
            )}

            <ErrorMessage message={error} />

            <p style={styles.privacy}>All processing happens in your browser. No images are saved or uploaded to any server.</p>

            {processing && (
                <div style={styles.spinnerWrap}>
                    <Spinner size={28} />
                    <span style={{ marginLeft: 8, color: "#555" }}>Analyzing image...</span>
                </div>
            )}

            {/* Preview + Controls */}
            {imagePreviewUrl && palette.length > 0 && (
                <>
                    <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        style={styles.preview}
                    />

                    <div style={styles.controls}>
                        <label style={styles.sliderLabel}>
                            Colors: {paletteSize}
                            <input
                                type="range"
                                min={3}
                                max={10}
                                value={paletteSize}
                                onChange={handleSliderChange}
                                style={styles.slider}
                            />
                        </label>

                        <div style={styles.formatGroup}>
                            {formats.map((fmt) => (
                                <button
                                    key={fmt}
                                    type="button"
                                    style={{
                                        ...styles.formatBtn,
                                        ...(colorFormat === fmt ? styles.formatBtnActive : {}),
                                    }}
                                    onClick={() => setColorFormat(fmt)}
                                >
                                    {fmt.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Swatches */}
                    <div style={styles.swatchRow}>
                        {palette.map((rgb, i) => {
                            const bg = rgbToHex(rgb);
                            const fg = getContrastColor(rgb);
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleCopy(i)}
                                    style={{
                                        ...styles.swatch,
                                        backgroundColor: bg,
                                        color: fg,
                                        borderColor: fg === "#000000" ? "#ddd" : "transparent",
                                    }}
                                    title="Click to copy"
                                >
                                    <span style={styles.swatchValue}>
                                        {copiedIndex === i ? "Copied!" : formatColor(rgb, colorFormat)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Export actions */}
                    <div style={styles.actions}>
                        <DownloadButton
                            href={palettePngUrl}
                            filename="palette.png"
                            label="Download PNG"
                        />
                        <button type="button" style={styles.cssBtn} onClick={handleCopyCss}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" />
                            </svg>
                            Copy CSS Variables
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: "24px 20px",
        maxWidth: "720px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    dropText: {
        margin: "8px 0 4px",
        fontSize: "16px",
        color: "#333",
    },
    dropSubtext: {
        margin: 0,
        fontSize: "13px",
        color: "#888",
    },
    fileRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        background: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #d0d7de",
    },
    fileName: {
        flex: 1,
        fontSize: "14px",
        color: "#333",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    replaceBtn: {
        padding: "6px 14px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        background: "#fff",
        cursor: "pointer",
        fontSize: "13px",
    },
    spinnerWrap: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 0",
    },
    preview: {
        maxWidth: "100%",
        maxHeight: "400px",
        objectFit: "contain",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        alignSelf: "center",
    },
    controls: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
    },
    sliderLabel: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "14px",
        fontWeight: 600,
        color: "#333",
    },
    slider: {
        width: "140px",
        cursor: "pointer",
    },
    formatGroup: {
        display: "flex",
        borderRadius: "6px",
        overflow: "hidden",
        border: "1px solid #ccc",
    },
    formatBtn: {
        padding: "6px 14px",
        border: "none",
        borderRight: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: 600,
        color: "#555",
    },
    formatBtnActive: {
        background: "#4a90d9",
        color: "#fff",
    },
    swatchRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
    },
    swatch: {
        flex: "1 1 70px",
        minWidth: "70px",
        maxWidth: "120px",
        aspectRatio: "1",
        border: "1px solid transparent",
        borderRadius: "10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "8px 4px",
        transition: "transform 0.15s",
    },
    swatchValue: {
        fontSize: "11px",
        fontWeight: 600,
        fontFamily: "monospace",
        wordBreak: "break-all",
        textAlign: "center",
        lineHeight: 1.2,
    },
    actions: {
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
    },
    cssBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.55rem 1rem",
        borderRadius: "8px",
        border: "1px solid #4a90d9",
        background: "#fff",
        color: "#4a90d9",
        cursor: "pointer",
        fontSize: "0.95rem",
        fontWeight: 500,
    },
    privacy: {
        margin: 0,
        fontSize: "12px",
        color: "#999",
        textAlign: "center",
    },
};
