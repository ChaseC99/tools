import { useState, useRef, useCallback, useEffect } from "react";
import ImageInput from "@tools/shared/ImageInput.tsx";
import DownloadButton from "@tools/shared/DownloadButton.tsx";
import ErrorMessage from "@tools/shared/ErrorMessage.tsx";
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
    const [copiedCss, setCopiedCss] = useState(false);
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
        setCopiedCss(true);
        setTimeout(() => setCopiedCss(false), 1500);
    }, [palette, colorFormat]);

    useEffect(() => {
        return () => {
            if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        };
    }, [imagePreviewUrl]);

    const formats: ColorFormat[] = ["hex", "rgb", "hsl"];

    return (
        <div className="ui-stack">
            <ImageInput
                onFile={handleFile}
                dragging={dragging}
                onDraggingChange={setDragging}
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.heic,.heif"
                formats={["PNG", "JPG", "WebP", "GIF", "SVG", "HEIC"]}
                fileName={file?.name}
                previewUrl={imagePreviewUrl}
                loading={processing}
                loadingLabel="Analyzing image…"
            />

            <ErrorMessage message={error} />

            <p className="ui-hint" style={{ textAlign: "center" }}>All processing happens in your browser. No images are saved or uploaded.</p>

            {/* Preview + Controls */}
            {imagePreviewUrl && palette.length > 0 && (
                <>
                    <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        style={styles.preview}
                    />

                    <div className="ui-action-bar ui-action-bar--split">
                        <label className="ui-field">
                            <span className="ui-label">Colors: {paletteSize}</span>
                            <input
                                className="ui-range"
                                type="range"
                                min={3}
                                max={10}
                                value={paletteSize}
                                onChange={handleSliderChange}
                            />
                        </label>

                        <div className="ui-segmented" role="group" aria-label="Color format">
                            {formats.map((fmt) => (
                                <button
                                    key={fmt}
                                    type="button"
                                    className="ui-button"
                                    aria-pressed={colorFormat === fmt}
                                    onClick={() => setColorFormat(fmt)}
                                >
                                    {fmt.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Swatches */}
                    <div className="ui-selectable-grid">
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
                    <div className="ui-action-bar">
                        <DownloadButton
                            href={palettePngUrl}
                            filename="palette.png"
                            label="Download PNG"
                        />
                        <button type="button" className="ui-button" data-variant="secondary" onClick={handleCopyCss}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" />
                            </svg>
                            {copiedCss ? "Copied CSS!" : "Copy CSS Variables"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    preview: {
        maxWidth: "100%",
        maxHeight: "400px",
        objectFit: "contain",
        borderRadius: "8px",
        border: "1px solid var(--ui-color-border)",
        alignSelf: "center",
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
};
