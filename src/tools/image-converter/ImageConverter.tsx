import { useState, useEffect, useCallback } from "react";
import { loadImage, canvasToBlob, decodeHeic } from "@tools/shared/imageUtils";
import ImageInput from "@tools/shared/ImageInput";
import Spinner from "@tools/shared/Spinner";
import DownloadButton from "@tools/shared/DownloadButton";
import ErrorMessage from "@tools/shared/ErrorMessage";

type Format = "heic" | "png" | "jpg" | "webp" | "svg" | "ico";

const FORMAT_LABELS: Record<Format, string> = {
    heic: "HEIC",
    png: "PNG",
    jpg: "JPG",
    webp: "WebP",
    svg: "SVG",
    ico: "ICO",
};

const MIME_TYPES: Record<Format, string> = {
    heic: "image/heic",
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
};

const VALID_OUTPUTS: Record<Format, Format[]> = {
    heic: ["jpg", "png", "webp", "ico"],
    png: ["jpg", "webp", "ico"],
    jpg: ["png", "webp", "ico"],
    webp: ["png", "jpg", "ico"],
    svg: ["png"],
    ico: [],
};

const ALL_OUTPUT_FORMATS: Format[] = ["png", "jpg", "webp", "ico"];

const EXT_TO_FORMAT: Record<string, Format> = {
    ".heic": "heic",
    ".heif": "heic",
    ".png": "png",
    ".jpg": "jpg",
    ".jpeg": "jpg",
    ".webp": "webp",
    ".svg": "svg",
};

const ICO_SIZES = [16, 32, 48];

function detectFormat(file: File): Format | null {
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && ext in EXT_TO_FORMAT) return EXT_TO_FORMAT[ext];
    return null;
}

function isLossyOutput(to: Format): boolean {
    return to === "jpg" || to === "webp";
}

function buildIco(pngBlobs: { size: number; data: ArrayBuffer }[]): Blob {
    const count = pngBlobs.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    const dirSize = dirEntrySize * count;
    let offset = headerSize + dirSize;

    const totalSize =
        offset + pngBlobs.reduce((sum, b) => sum + b.data.byteLength, 0);
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, count, true);

    for (let i = 0; i < count; i++) {
        const entry = pngBlobs[i];
        const entryOffset = headerSize + i * dirEntrySize;
        const sz = entry.size >= 256 ? 0 : entry.size;
        view.setUint8(entryOffset, sz);
        view.setUint8(entryOffset + 1, sz);
        view.setUint8(entryOffset + 2, 0);
        view.setUint8(entryOffset + 3, 0);
        view.setUint16(entryOffset + 4, 1, true);
        view.setUint16(entryOffset + 6, 32, true);
        view.setUint32(entryOffset + 8, entry.data.byteLength, true);
        view.setUint32(entryOffset + 12, offset, true);
        offset += entry.data.byteLength;
    }

    let dataOffset = headerSize + dirSize;
    const bytes = new Uint8Array(buffer);
    for (const entry of pngBlobs) {
        bytes.set(new Uint8Array(entry.data), dataOffset);
        dataOffset += entry.data.byteLength;
    }

    return new Blob([buffer], { type: "image/x-icon" });
}

function getInitialTo(): Format {
    if (typeof window === "undefined") return "jpg";
    const params = new URLSearchParams(window.location.search);
    const t = params.get("to") as Format | null;
    if (t && t in FORMAT_LABELS) return t;
    return "jpg";
}

export default function ImageConverter() {
    const [from, setFrom] = useState<Format | null>(null);
    const [to, setTo] = useState<Format>(getInitialTo);
    const [file, setFile] = useState<File | null>(null);
    const [inputPreview, setInputPreview] = useState<string | null>(null);
    const [quality, setQuality] = useState(0.92);
    const [svgWidth, setSvgWidth] = useState(1024);
    const [icoSizes, setIcoSizes] = useState<number[]>([16, 32, 48]);
    const [converting, setConverting] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [resultPreviewUrl, setResultPreviewUrl] = useState<string | null>(
        null,
    );
    const [resultName, setResultName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);

    // Cleanup URLs on unmount or change
    useEffect(() => {
        return () => {
            if (resultUrl) URL.revokeObjectURL(resultUrl);
        };
    }, [resultUrl]);

    useEffect(() => {
        return () => {
            if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
        };
    }, [resultPreviewUrl]);

    useEffect(() => {
        return () => {
            if (inputPreview) URL.revokeObjectURL(inputPreview);
        };
    }, [inputPreview]);

    const handleFile = useCallback(
        (f: File | null) => {
            if (!f) return;
            const detected = detectFormat(f);
            if (!detected) {
                setError("Unsupported file type");
                return;
            }
            const outputs = VALID_OUTPUTS[detected];
            if (outputs.length === 0) {
                setError("No conversions available for this format");
                return;
            }

            setFile(f);
            setFrom(detected);
            setError(null);
            setResultUrl(null);
            setResultPreviewUrl(null);

            // Set input preview (HEIC can't be previewed directly in browsers)
            if (inputPreview) URL.revokeObjectURL(inputPreview);
            if (detected !== "heic") {
                setInputPreview(URL.createObjectURL(f));
            } else {
                setInputPreview(null);
            }

            // Update output format if current selection isn't valid for this input
            if (!outputs.includes(to)) {
                setTo(outputs[0]);
            }
        },
        [inputPreview, to],
    );

    const toggleIcoSize = (size: number) => {
        setIcoSizes((prev) =>
            prev.includes(size)
                ? prev.filter((s) => s !== size)
                : [...prev, size].sort((a, b) => a - b),
        );
    };

    // Auto-convert whenever inputs change
    useEffect(() => {
        if (!file || !from || !to) return;
        if (!VALID_OUTPUTS[from]?.includes(to)) return;

        let cancelled = false;
        const run = async () => {
            setConverting(true);
            setError(null);
            setResultUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
            setResultPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });

            try {
                let sourceBlob: Blob = file;

                if (from === "heic") {
                    sourceBlob = await decodeHeic(file);
                    // Also set input preview from decoded HEIC
                    if (!cancelled) {
                        setInputPreview((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return URL.createObjectURL(sourceBlob);
                        });
                    }
                }

                if (cancelled) return;

                const sourceBlobUrl = URL.createObjectURL(sourceBlob);

                if (to === "ico") {
                    const sizes = icoSizes.length > 0 ? icoSizes : [32];
                    const img = await loadImage(sourceBlobUrl);
                    if (cancelled) {
                        URL.revokeObjectURL(sourceBlobUrl);
                        return;
                    }
                    const pngEntries: { size: number; data: ArrayBuffer }[] =
                        [];

                    for (const size of sizes) {
                        const canvas = document.createElement("canvas");
                        canvas.width = size;
                        canvas.height = size;
                        const ctx = canvas.getContext("2d")!;
                        ctx.drawImage(img, 0, 0, size, size);
                        const pngBlob = await canvasToBlob(
                            canvas,
                            "image/png",
                        );
                        pngEntries.push({
                            size,
                            data: await pngBlob.arrayBuffer(),
                        });
                    }

                    // Generate a preview at the largest ICO size
                    const previewSize = Math.max(...sizes);
                    const previewCanvas = document.createElement("canvas");
                    previewCanvas.width = previewSize;
                    previewCanvas.height = previewSize;
                    const previewCtx = previewCanvas.getContext("2d")!;
                    previewCtx.drawImage(
                        img,
                        0,
                        0,
                        previewSize,
                        previewSize,
                    );
                    const previewBlob = await canvasToBlob(
                        previewCanvas,
                        "image/png",
                    );

                    URL.revokeObjectURL(sourceBlobUrl);
                    if (cancelled) return;
                    const icoBlob = buildIco(pngEntries);
                    const baseName = file.name.replace(/\.[^.]+$/, "");
                    setResultUrl(URL.createObjectURL(icoBlob));
                    setResultPreviewUrl(URL.createObjectURL(previewBlob));
                    setResultName(`${baseName}.ico`);
                } else {
                    const img = await loadImage(sourceBlobUrl);
                    if (cancelled) {
                        URL.revokeObjectURL(sourceBlobUrl);
                        return;
                    }
                    const canvas = document.createElement("canvas");

                    if (from === "svg") {
                        const aspect =
                            img.naturalHeight / img.naturalWidth;
                        canvas.width = svgWidth;
                        canvas.height = Math.round(svgWidth * aspect);
                    } else {
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                    }

                    const ctx = canvas.getContext("2d")!;

                    if (to === "jpg") {
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(sourceBlobUrl);

                    if (cancelled) return;

                    const outputMime = MIME_TYPES[to];
                    const q = isLossyOutput(to) ? quality : undefined;
                    const resultBlob = await canvasToBlob(
                        canvas,
                        outputMime,
                        q,
                    );
                    const baseName = file.name.replace(/\.[^.]+$/, "");
                    const ext = to === "jpg" ? "jpg" : to;
                    setResultUrl(URL.createObjectURL(resultBlob));
                    setResultName(`${baseName}.${ext}`);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Conversion failed",
                    );
                }
            } finally {
                if (!cancelled) {
                    setConverting(false);
                }
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [file, from, to, quality, svgWidth, icoSizes]);

    const outputs = from ? VALID_OUTPUTS[from] : ALL_OUTPUT_FORMATS;
    const previewSrc = to === "ico" ? resultPreviewUrl : resultUrl;

    return (
        <section className="image-converter-flow ui-stack">
            <p className="ui-hint" style={{ textAlign: "center" }}>
                Choose a source image, then select the output format below.
            </p>
            <ImageInput
                onFile={handleFile}
                dragging={dragging}
                onDraggingChange={setDragging}
                accept="image/*,.heic,.heif"
                formats={["HEIC", "PNG", "JPG", "WebP", "SVG"]}
                fileName={file?.name}
                previewUrl={inputPreview}
                previewAlt={file ? `Preview of ${file.name}` : "Selected image preview"}
            />

            <div className="image-converter-flow__arrow" aria-hidden="true">↓</div>

            <div className="image-converter-flow__options ui-panel ui-stack" data-variant="inset">
                <label className="ui-field">
                    <span className="ui-label">Convert to</span>
                    <select
                        className="ui-select"
                        value={to}
                        onChange={(e) => setTo(e.target.value as Format)}
                    >
                        {outputs.map((fmt) => (
                            <option key={fmt} value={fmt}>
                                {FORMAT_LABELS[fmt]}
                            </option>
                        ))}
                    </select>
                </label>

                {isLossyOutput(to) && (
                    <label className="ui-field">
                        <span className="ui-label">Quality: {Math.round(quality * 100)}%</span>
                        <input
                            className="ui-range"
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={quality}
                            onChange={(e) =>
                                setQuality(parseFloat(e.target.value))
                            }
                        />
                    </label>
                )}

                {from === "svg" && to === "png" && (
                    <label className="ui-field">
                        <span className="ui-label">Width (px)</span>
                        <input
                            className="ui-input"
                            type="number"
                            min="1"
                            max="8192"
                            value={svgWidth}
                            onChange={(e) =>
                                setSvgWidth(
                                    Math.max(
                                        1,
                                        parseInt(e.target.value) || 1,
                                    ),
                                )
                            }
                        />
                    </label>
                )}

                {to === "ico" && (
                    <div className="ui-field">
                        <span className="ui-label">Sizes</span>
                        <div className="ui-inline">
                          {ICO_SIZES.map((size) => (
                            <label key={size} className="ui-choice">
                                <input
                                    type="checkbox"
                                    checked={icoSizes.includes(size)}
                                    onChange={() => toggleIcoSize(size)}
                                />
                                {size}
                            </label>
                          ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="image-converter-flow__arrow" aria-hidden="true">↓</div>

            <div className="image-converter-flow__output ui-result-card ui-stack" aria-live="polite">
                {converting && (
                    <div className="ui-stack" data-gap="sm">
                        <Spinner />
                        <p className="ui-muted">Converting…</p>
                    </div>
                )}

                {!converting && <ErrorMessage message={error} />}

                {resultUrl && !converting && !error && (
                    <>
                        {previewSrc && (
                            <img
                                src={previewSrc}
                                alt="Converted result"
                                className="image-converter-flow__preview"
                            />
                        )}
                        <p className="ui-muted image-converter-flow__filename">
                            {resultName}
                        </p>
                        <DownloadButton
                            href={resultUrl}
                            filename={resultName}
                        />
                    </>
                )}

                {!resultUrl && !converting && !error && (
                    <div className="ui-empty-state">Output will appear here.</div>
                )}
            </div>

            <p className="ui-hint" style={{ textAlign: "center" }}>
                All conversions happen in your browser—no images are saved or uploaded.
            </p>
        </section>
    );
}
