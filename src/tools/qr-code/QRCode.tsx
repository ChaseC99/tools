import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import ImageDropZone from "@tools/shared/ImageDropZone";
import DownloadButton from "@tools/shared/DownloadButton";
import CollapsibleSection from "@tools/shared/CollapsibleSection";
import ErrorMessage from "@tools/shared/ErrorMessage";

type DotType = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
type CornerSquareType = "square" | "extra-rounded" | "dot";
type CornerDotType = "square" | "dot";
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type DownloadFormat = "png" | "svg" | "jpeg";
type QRUpdateOptions = {
    width: number;
    height: number;
    data?: string;
    image?: string;
    dotsOptions: { type: DotType; color: string };
    backgroundOptions: { color: string };
    cornersSquareOptions: { type: CornerSquareType };
    cornersDotOptions: { type: CornerDotType };
    imageOptions: { crossOrigin: "anonymous"; margin: number };
    qrOptions: { errorCorrectionLevel: ErrorCorrectionLevel };
};

type QRCodeInstance = {
    append: (container: HTMLElement) => void;
    update: (options: QRUpdateOptions) => void;
    download: (options: { name: string; extension: DownloadFormat }) => void;
};

const MAX_LOGO_SIZE_MB = 5;

export default function QRCode() {
    const [text, setText] = useState("");
    const [size, setSize] = useState(256);
    const [userErrorCorrection, setUserErrorCorrection] = useState<ErrorCorrectionLevel>("M");
    const [fgColor, setFgColor] = useState("#000000");
    const [bgColor, setBgColor] = useState("#ffffff");
    const [dotType, setDotType] = useState<DotType>("square");
    const [cornerSquareType, setCornerSquareType] = useState<CornerSquareType>("square");
    const [cornerDotType, setCornerDotType] = useState<CornerDotType>("square");
    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
    const [logoName, setLogoName] = useState<string | null>(null);
    const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("png");
    const [dragging, setDragging] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [qrLoadError, setQrLoadError] = useState<string | null>(null);
    const [logoError, setLogoError] = useState<string | null>(null);

    const qrContainerRef = useRef<HTMLDivElement>(null);
    const qrInstanceRef = useRef<QRCodeInstance | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    const effectiveErrorCorrection: ErrorCorrectionLevel = logoDataUrl ? "H" : userErrorCorrection;
    const previewMaxSize = isMobile ? 280 : 360;
    const previewScale = Math.min(1, previewMaxSize / size);
    const previewDisplaySize = Math.round(size * previewScale);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 600);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setQrLoadError(null);

        import("qr-code-styling")
            .then((mod) => {
                if (cancelled) return;
                const QRCodeStyling = mod.default as new (options: QRUpdateOptions) => QRCodeInstance;
                const qr = new QRCodeStyling({
                    width: size,
                    height: size,
                    data: text || undefined,
                    dotsOptions: { type: dotType, color: fgColor },
                    backgroundOptions: { color: bgColor },
                    cornersSquareOptions: { type: cornerSquareType },
                    cornersDotOptions: { type: cornerDotType },
                    imageOptions: { crossOrigin: "anonymous", margin: 4 },
                    qrOptions: { errorCorrectionLevel: effectiveErrorCorrection },
                });
                qrInstanceRef.current = qr;
                if (qrContainerRef.current) {
                    qrContainerRef.current.innerHTML = "";
                    qr.append(qrContainerRef.current);
                }
            })
            .catch(() => {
                if (cancelled) return;
                setQrLoadError("Unable to load the QR renderer. Please refresh and try again.");
                qrInstanceRef.current = null;
            });

        return () => { cancelled = true; };
    }, [size, text, dotType, fgColor, bgColor, cornerSquareType, cornerDotType, effectiveErrorCorrection]);

    useEffect(() => {
        if (!qrInstanceRef.current) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            qrInstanceRef.current!.update({
                width: size,
                height: size,
                data: text || undefined,
                dotsOptions: { type: dotType, color: fgColor },
                backgroundOptions: { color: bgColor },
                cornersSquareOptions: { type: cornerSquareType },
                cornersDotOptions: { type: cornerDotType },
                image: logoDataUrl || undefined,
                imageOptions: { crossOrigin: "anonymous", margin: 4 },
                qrOptions: { errorCorrectionLevel: effectiveErrorCorrection },
            });
        }, 150);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [text, size, effectiveErrorCorrection, fgColor, bgColor, dotType, cornerSquareType, cornerDotType, logoDataUrl]);

    const handleLogoFile = useCallback((file: File) => {
        setLogoError(null);
        if (!file.type.startsWith("image/")) {
            setLogoError("Logo must be an image file.");
            return;
        }
        if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
            setLogoError(`Logo must be smaller than ${MAX_LOGO_SIZE_MB}MB.`);
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => setLogoError("Could not read the logo file. Please try another image.");
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                setLogoError("Could not process the selected image.");
                return;
            }
            setLogoDataUrl(reader.result);
            setLogoName(file.name);
        };
        reader.readAsDataURL(file);
    }, []);

    const removeLogo = useCallback(() => {
        setLogoDataUrl(null);
        setLogoName(null);
        setLogoError(null);
    }, []);

    const handleDownload = useCallback(() => {
        if (!qrInstanceRef.current || !text.trim()) return;
        qrInstanceRef.current.download({ name: "qrcode", extension: downloadFormat });
    }, [downloadFormat, text]);

    const containerStyle: CSSProperties = {
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: "1.5rem",
        maxWidth: 900,
        margin: "0 auto",
        padding: "1rem",
        alignItems: "flex-start",
    };

    const leftPaneStyle: CSSProperties = {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        minWidth: 0,
    };

    const rightPaneStyle: CSSProperties = {
        flex: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        border: "1px solid #333",
        borderRadius: 12,
        padding: "1.5rem",
        minWidth: 0,
        alignSelf: isMobile ? "stretch" : "flex-start",
    };

    return (
        <div style={containerStyle}>
            <div style={leftPaneStyle}>
                {/* Content */}
                <div style={styles.section}>
                    <label style={styles.sectionLabel} htmlFor="qr-content">Content</label>
                    <input
                        id="qr-content"
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Enter text or URL..."
                        style={styles.input}
                    />
                </div>

                {/* General */}
                <div style={styles.section}>
                    <label style={styles.sectionLabel}>General</label>
                    <div style={styles.flexRow}>
                        <div style={styles.flex1}>
                            <label style={styles.fieldLabel} htmlFor="qr-size">Size</label>
                            <select id="qr-size" value={size} onChange={(e) => setSize(Number(e.target.value))} style={styles.select}>
                                <option value={128}>128px</option>
                                <option value={256}>256px</option>
                                <option value={512}>512px</option>
                                <option value={1024}>1024px</option>
                            </select>
                        </div>
                        <div style={styles.flex1}>
                            <label style={styles.fieldLabel} htmlFor="qr-ec">Error Correction</label>
                            <select
                                id="qr-ec"
                                value={effectiveErrorCorrection}
                                onChange={(e) => setUserErrorCorrection(e.target.value as ErrorCorrectionLevel)}
                                disabled={!!logoDataUrl}
                                style={{
                                    ...styles.select,
                                    opacity: logoDataUrl ? 0.6 : 1,
                                    cursor: logoDataUrl ? "not-allowed" : "pointer",
                                }}
                            >
                                <option value="L">Low</option>
                                <option value="M">Medium</option>
                                <option value="Q">Quartile</option>
                                <option value="H">High</option>
                            </select>
                            {logoDataUrl && (
                                <p style={styles.hint}>
                                    Logo overlay requires high error correction
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Colors */}
                <CollapsibleSection label="Colors">
                    <div style={styles.column}>
                        <div>
                            <label style={styles.fieldLabel} htmlFor="qr-fg">Foreground</label>
                            <div style={styles.colorRow}>
                                <input id="qr-fg" type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} style={styles.colorSwatch} />
                                <input
                                    aria-label="Foreground color hex"
                                    type="text"
                                    value={fgColor}
                                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setFgColor(e.target.value); }}
                                    style={styles.colorHex}
                                    maxLength={7}
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            aria-label="Swap foreground and background colors"
                            title="Swap foreground and background colors"
                            onClick={() => { setFgColor(bgColor); setBgColor(fgColor); }}
                            style={styles.swapButton}
                        >
                            ⇅
                        </button>
                        <div>
                            <label style={styles.fieldLabel} htmlFor="qr-bg">Background</label>
                            <div style={styles.colorRow}>
                                <input id="qr-bg" type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={styles.colorSwatch} />
                                <input
                                    aria-label="Background color hex"
                                    type="text"
                                    value={bgColor}
                                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBgColor(e.target.value); }}
                                    style={styles.colorHex}
                                    maxLength={7}
                                />
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* Shapes */}
                <CollapsibleSection label="Shapes">
                    <div style={styles.column}>
                        <div>
                            <label style={styles.fieldLabel} htmlFor="qr-dot">Dot Style</label>
                            <select id="qr-dot" value={dotType} onChange={(e) => setDotType(e.target.value as DotType)} style={styles.select}>
                                <option value="square">Square</option>
                                <option value="rounded">Rounded</option>
                                <option value="dots">Dots</option>
                                <option value="classy">Classy</option>
                                <option value="classy-rounded">Classy Rounded</option>
                                <option value="extra-rounded">Extra Rounded</option>
                            </select>
                        </div>
                        <div>
                            <label style={styles.fieldLabel} htmlFor="qr-csq">Corner Square Style</label>
                            <select id="qr-csq" value={cornerSquareType} onChange={(e) => setCornerSquareType(e.target.value as CornerSquareType)} style={styles.select}>
                                <option value="square">Square</option>
                                <option value="extra-rounded">Extra Rounded</option>
                                <option value="dot">Dot</option>
                            </select>
                        </div>
                        <div>
                            <label style={styles.fieldLabel} htmlFor="qr-cd">Corner Dot Style</label>
                            <select id="qr-cd" value={cornerDotType} onChange={(e) => setCornerDotType(e.target.value as CornerDotType)} style={styles.select}>
                                <option value="square">Square</option>
                                <option value="dot">Dot</option>
                            </select>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* Logo */}
                <CollapsibleSection label="Logo">
                    {logoDataUrl ? (
                        <div style={styles.row}>
                            <img src={logoDataUrl} alt="Logo preview" style={styles.logoThumb} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={styles.logoName}>{logoName}</div>
                            </div>
                            <button type="button" onClick={removeLogo} style={styles.removeButton}>Remove</button>
                        </div>
                    ) : (
                        <ImageDropZone
                            onFile={handleLogoFile}
                            dragging={dragging}
                            onDraggingChange={setDragging}
                            accept="image/*"
                            theme="dark"
                            style={{ padding: "0.75rem" }}
                        >
                            <p style={styles.muted}>Drop a logo here or click to select</p>
                        </ImageDropZone>
                    )}
                    <ErrorMessage message={logoError} theme="dark" />
                </CollapsibleSection>
            </div>

            {/* Right Pane */}
            <div style={rightPaneStyle}>
                <div style={{ width: previewDisplaySize, height: previewDisplaySize, overflow: "hidden", border: !text.trim() ? "1px dashed #333" : "none" }}>
                    <div style={{ width: size, height: size, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                        <div ref={qrContainerRef} style={styles.qrCanvas} />
                        {!text.trim() && <p style={styles.placeholder}>Enter text or a URL to generate a QR code</p>}
                    </div>
                </div>
                <ErrorMessage message={qrLoadError} theme="dark" style={{ textAlign: "center", maxWidth: 320 }} />
                <div style={styles.downloadRow}>
                    <select
                        aria-label="Download format"
                        value={downloadFormat}
                        onChange={(e) => setDownloadFormat(e.target.value as DownloadFormat)}
                        style={styles.selectSmall}
                    >
                        <option value="png">PNG</option>
                        <option value="svg">SVG</option>
                        <option value="jpeg">JPEG</option>
                    </select>
                    <DownloadButton
                        onClick={handleDownload}
                        filename={`qrcode.${downloadFormat}`}
                        disabled={!text.trim()}
                        label="Download"
                        theme="dark"
                    />
                </div>
            </div>
        </div>
    );
}


const styles: Record<string, CSSProperties> = {
    // Layout
    section: { display: "flex", flexDirection: "column", gap: "0.5rem" },
    column: { display: "flex", flexDirection: "column", gap: "0.5rem" },
    row: { display: "flex", alignItems: "center", gap: "0.75rem" },
    flex1: { flex: 1 },
    flexRow: { display: "flex", gap: "0.75rem" },

    // Typography
    sectionLabel: {
        color: "#999",
        fontSize: "0.8rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    fieldLabel: {
        color: "#888",
        fontSize: "0.8rem",
        marginBottom: 4,
        display: "block",
    },
    hint: { margin: "4px 0 0 4px", color: "#888", fontSize: "0.75rem" },
    muted: { margin: 0, color: "#888", fontSize: "0.85rem" },
    placeholder: {
        color: "#555",
        margin: 0,
        fontSize: "0.9rem",
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
    },

    // Form controls
    input: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #333",
        backgroundColor: "transparent",
        fontSize: "0.95rem",
        boxSizing: "border-box",
    },
    select: {
        width: "100%",
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #333",
        backgroundColor: "transparent",
        fontSize: "0.95rem",
        boxSizing: "border-box",
    },
    selectSmall: {
        width: "auto",
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #333",
        backgroundColor: "transparent",
        fontSize: "0.85rem",
        boxSizing: "border-box",
    },
    colorSwatch: {
        width: 36,
        height: 36,
        border: "1px solid #333",
        borderRadius: 6,
        cursor: "pointer",
        padding: 0,
        backgroundColor: "transparent",
    },
    colorHex: {
        flex: 1,
        width: "100%",
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #333",
        backgroundColor: "transparent",
        fontSize: "0.85rem",
        fontFamily: "monospace",
        boxSizing: "border-box",
    },
    colorRow: { display: "flex", alignItems: "center", gap: "0.5rem" },

    // Buttons
    swapButton: {
        alignSelf: "start",
        padding: "2px 10px",
        borderRadius: 6,
        border: "1px solid #333",
        backgroundColor: "transparent",
        color: "#888",
        cursor: "pointer",
        fontSize: "0.85rem",
    },
    removeButton: {
        padding: "4px 12px",
        borderRadius: 6,
        border: "1px solid #444",
        backgroundColor: "transparent",
        color: "#e55",
        cursor: "pointer",
        fontSize: "0.8rem",
    },

    // Logo preview
    logoThumb: {
        width: 48,
        height: 48,
        borderRadius: 6,
        objectFit: "contain",
        border: "1px solid #333",
    },
    logoName: {
        color: "#ccc",
        fontSize: "0.85rem",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },

    // QR preview
    qrCanvas: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    // Download row
    downloadRow: {
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        marginTop: "0.5rem",
    },
};