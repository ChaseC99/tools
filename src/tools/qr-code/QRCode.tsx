import { useState, useEffect, useRef, useCallback } from "react";
import ImageDropZone from "@tools/shared/ImageDropZone";
import DownloadButton from "@tools/shared/DownloadButton";
import CollapsibleSection from "@tools/shared/CollapsibleSection";
import ErrorMessage from "@tools/shared/ErrorMessage";
import "./QRCode.css";

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

    return (
        <div className="qr-workspace ui-workspace">
            <section className="qr-controls ui-panel ui-stack" aria-label="QR code settings">
                <div className="ui-field">
                    <label className="ui-section-label" htmlFor="qr-content">Content</label>
                    <input
                        id="qr-content"
                        className="ui-input"
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Enter text or URL..."
                    />
                </div>

                <div className="ui-stack" data-gap="sm">
                    <span className="ui-section-label">General</span>
                    <div className="ui-grid qr-general-grid">
                        <label className="ui-field" htmlFor="qr-size">
                            <span className="ui-label">Size</span>
                            <select id="qr-size" className="ui-select" value={size} onChange={(e) => setSize(Number(e.target.value))}>
                                <option value={128}>128px</option>
                                <option value={256}>256px</option>
                                <option value={512}>512px</option>
                                <option value={1024}>1024px</option>
                            </select>
                        </label>
                        <label className="ui-field" htmlFor="qr-ec">
                            <span className="ui-label">Error correction</span>
                            <select
                                id="qr-ec"
                                className="ui-select"
                                value={effectiveErrorCorrection}
                                onChange={(e) => setUserErrorCorrection(e.target.value as ErrorCorrectionLevel)}
                                disabled={!!logoDataUrl}
                            >
                                <option value="L">Low</option>
                                <option value="M">Medium</option>
                                <option value="Q">Quartile</option>
                                <option value="H">High</option>
                            </select>
                            {logoDataUrl && (
                                <span className="ui-hint">Logo overlay requires high error correction.</span>
                            )}
                        </label>
                    </div>
                </div>

                <CollapsibleSection label="Colors">
                    <div className="qr-colors">
                        <label className="ui-field" htmlFor="qr-fg">
                            <span className="ui-label">Foreground</span>
                            <div className="ui-color-field">
                                <input id="qr-fg" className="ui-color-input" type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} />
                                <input
                                    aria-label="Foreground color hex"
                                    className="ui-input qr-color-value"
                                    type="text"
                                    value={fgColor}
                                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setFgColor(e.target.value); }}
                                    maxLength={7}
                                />
                            </div>
                        </label>
                        <button
                            type="button"
                            className="ui-button ui-icon-button qr-swap"
                            data-variant="secondary"
                            data-size="sm"
                            aria-label="Swap foreground and background colors"
                            title="Swap foreground and background colors"
                            onClick={() => { setFgColor(bgColor); setBgColor(fgColor); }}
                        >
                            ⇅
                        </button>
                        <label className="ui-field" htmlFor="qr-bg">
                            <span className="ui-label">Background</span>
                            <div className="ui-color-field">
                                <input id="qr-bg" className="ui-color-input" type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                                <input
                                    aria-label="Background color hex"
                                    className="ui-input qr-color-value"
                                    type="text"
                                    value={bgColor}
                                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBgColor(e.target.value); }}
                                    maxLength={7}
                                />
                            </div>
                        </label>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection label="Shapes">
                    <div className="ui-grid qr-shape-grid">
                        <label className="ui-field" htmlFor="qr-dot">
                            <span className="ui-label">Dot style</span>
                            <select id="qr-dot" className="ui-select" value={dotType} onChange={(e) => setDotType(e.target.value as DotType)}>
                                <option value="square">Square</option>
                                <option value="rounded">Rounded</option>
                                <option value="dots">Dots</option>
                                <option value="classy">Classy</option>
                                <option value="classy-rounded">Classy Rounded</option>
                                <option value="extra-rounded">Extra Rounded</option>
                            </select>
                        </label>
                        <label className="ui-field" htmlFor="qr-csq">
                            <span className="ui-label">Corner square style</span>
                            <select id="qr-csq" className="ui-select" value={cornerSquareType} onChange={(e) => setCornerSquareType(e.target.value as CornerSquareType)}>
                                <option value="square">Square</option>
                                <option value="extra-rounded">Extra Rounded</option>
                                <option value="dot">Dot</option>
                            </select>
                        </label>
                        <label className="ui-field" htmlFor="qr-cd">
                            <span className="ui-label">Corner dot style</span>
                            <select id="qr-cd" className="ui-select" value={cornerDotType} onChange={(e) => setCornerDotType(e.target.value as CornerDotType)}>
                                <option value="square">Square</option>
                                <option value="dot">Dot</option>
                            </select>
                        </label>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection label="Logo">
                    {logoDataUrl ? (
                        <div className="qr-logo-row">
                            <img src={logoDataUrl} alt="Logo preview" className="qr-logo-thumb" />
                            <span className="qr-logo-name">{logoName}</span>
                            <button type="button" className="ui-button" data-variant="danger" data-size="sm" onClick={removeLogo}>Remove</button>
                        </div>
                    ) : (
                        <ImageDropZone
                            onFile={handleLogoFile}
                            dragging={dragging}
                            onDraggingChange={setDragging}
                            accept="image/*"
                            label="Choose a logo image or drop it here"
                        >
                            <p className="ui-muted">Drop a logo here or click to select</p>
                        </ImageDropZone>
                    )}
                    <ErrorMessage message={logoError} />
                </CollapsibleSection>
            </section>

            <aside className="qr-preview-panel ui-panel ui-stack" data-elevation="raised" aria-label="QR code preview">
                <span className="ui-section-label">Preview</span>
                <div
                    className="qr-preview-frame"
                    data-empty={String(!text.trim())}
                    style={{ width: previewDisplaySize, height: previewDisplaySize }}
                >
                    <div className="qr-preview-scale" style={{ width: size, height: size, transform: `scale(${previewScale})` }}>
                        <div ref={qrContainerRef} className="qr-canvas" />
                    </div>
                    {!text.trim() && <p className="qr-placeholder">Enter text or a URL to generate a QR code.</p>}
                </div>
                <ErrorMessage message={qrLoadError} style={{ textAlign: "center", maxWidth: 320 }} />
                <div className="qr-download-row">
                    <label className="ui-sr-only" htmlFor="qr-download-format">Download format</label>
                    <select
                        id="qr-download-format"
                        className="ui-select qr-download-format"
                        value={downloadFormat}
                        onChange={(e) => setDownloadFormat(e.target.value as DownloadFormat)}
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
                    />
                </div>
            </aside>
        </div>
    );
}
