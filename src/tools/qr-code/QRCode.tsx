import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ImageInput from "@tools/shared/ImageInput";
import DownloadButton from "@tools/shared/DownloadButton";
import CollapsibleSection from "@tools/shared/CollapsibleSection";
import ErrorMessage from "@tools/shared/ErrorMessage";
import type { Options } from "qr-code-styling";
import { createQRImageSource, createQRRenderer, DEFAULT_BORDER_SPACING, getQRLayout, isHexColor, normalizeWebsiteUrl } from "./qrLogic.mjs";
import ErrorCorrectionHelp from "./ErrorCorrectionHelp";
import ShapePicker from "./ShapePicker";
import QRScanSafeguards from "./QRScanSafeguards";
import LogoControls from "./LogoControls";
import { addLogoOverlay, DEFAULT_LOGO_SETTINGS, type LogoOverlay, type LogoSettings, type LogoSource } from "./qrLogo";
import { copyQRImage, downloadQRImage, exportQRImage, loadImage, prepareLogo } from "./qrImage";
import { saveQRFile, supportsMobileShare } from "./qrDownload.mjs";
import { cornerOptions, styleQRCorners, type CornerType } from "./qrCornerShapes";
import "./QRCode.css";

type DotType = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type DownloadFormat = "png" | "svg" | "jpeg";
type QRRequest = Options & { logo?: LogoOverlay; corners: { outer: CornerType; inner: CornerType } };
type QRImageSource = (request: QRRequest, getOptions: () => QRRequest, retain?: boolean) => Promise<Blob>;
type Preview = { request: QRRequest; blob: Blob; url: string };

export default function QRCode() {
    const [text, setText] = useState("");
    const normalizedUrl = normalizeWebsiteUrl(text);
    const [size, setSize] = useState(1000);
    const [borderSpacing, setBorderSpacing] = useState(DEFAULT_BORDER_SPACING);
    const [borderRadius, setBorderRadius] = useState(0);
    const [userErrorCorrection, setUserErrorCorrection] = useState<ErrorCorrectionLevel>("M");
    const [fgColor, setFgColor] = useState("#000000");
    const [bgColor, setBgColor] = useState("#ffffff");
    const [fgDraft, setFgDraft] = useState("#000000");
    const [bgDraft, setBgDraft] = useState("#ffffff");
    const [dotType, setDotType] = useState<DotType>("square");
    const [cornerSquareType, setCornerSquareType] = useState<CornerType>("square");
    const [cornerDotType, setCornerDotType] = useState<CornerType>("square");
    const [logoSource, setLogoSource] = useState<LogoSource | null>(null);
    const [logoSettings, setLogoSettings] = useState<LogoSettings>({ ...DEFAULT_LOGO_SETTINGS });
    const logoDataUrl = logoSource?.dataUrl;
    const [logoName, setLogoName] = useState<string | null>(null);
    const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("png");
    const [dragging, setDragging] = useState(false);
    const [rendererReady, setRendererReady] = useState(false);
    const [qrLoadError, setQrLoadError] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [logoError, setLogoError] = useState<string | null>(null);
    const [logoLoading, setLogoLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [copyState, setCopyState] = useState<{ request: Options; status: "copying" | "copied" | "error"; message?: string } | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [mobileSharing, setMobileSharing] = useState(false);
    const [preparedDownload, setPreparedDownload] = useState<{ request: QRRequest; format: DownloadFormat; file: File | null } | null>(null);
    const imageSourceRef = useRef<QRImageSource | null>(null);
    const logoRequestRef = useRef(0);
    const effectiveErrorCorrection: ErrorCorrectionLevel = logoDataUrl ? "H" : userErrorCorrection;
    const colorsValid = isHexColor(fgDraft) && isHexColor(bgDraft);
    const identicalColors = fgColor.toLowerCase() === bgColor.toLowerCase();
    const { layout, layoutError } = useMemo(() => {
        try {
            return { layout: getQRLayout(normalizedUrl, size, effectiveErrorCorrection, borderSpacing), layoutError: null };
        } catch (error) {
            return { layout: null, layoutError: error instanceof Error ? error.message : "Could not calculate the QR layout." };
        }
    }, [normalizedUrl, size, effectiveErrorCorrection, borderSpacing]);
    const maxBorderRadius = layout?.maxRadiusPercent ?? 0;
    const effectiveBorderRadius = Math.min(borderRadius, maxBorderRadius);

    useEffect(() => {
        // Keep the slider's saved value consistent when spacing or content
        // reduces the room available for rounded corners.
        if (layout) setBorderRadius((current) => Math.min(current, maxBorderRadius));
    }, [layout, maxBorderRadius]);

    const request = useMemo<QRRequest>(() => ({
        width: size,
        height: size,
        data: normalizedUrl,
        image: "",
        logo: logoSource ? { source: logoSource, settings: logoSettings } : undefined,
        dotsOptions: { type: dotType, color: fgColor },
        backgroundOptions: { color: bgColor, round: effectiveBorderRadius / 50 },
        corners: { outer: cornerSquareType, inner: cornerDotType },
        cornersSquareOptions: { type: "square", color: fgColor },
        cornersDotOptions: { type: "square", color: fgColor },
        qrOptions: { errorCorrectionLevel: effectiveErrorCorrection },
    }), [normalizedUrl, size, logoSource, logoSettings, dotType, fgColor, bgColor, cornerSquareType, cornerDotType, effectiveErrorCorrection, borderSpacing, effectiveBorderRadius]);
    const previewCurrent = preview?.request === request;
    const showPreview = !!preview && !!normalizedUrl && !renderError && !qrLoadError;
    const canDownload = rendererReady && !!normalizedUrl && !!layout && colorsValid
        && !identicalColors && !logoLoading && !downloading && !renderError && !qrLoadError;

    const copying = copyState?.status === "copying";
    const copied = copyState?.request === request && copyState.status === "copied";
    const copyError = copyState?.request === request && copyState.status === "error" ? copyState.message : null;
    const downloadPrepared = preparedDownload?.request === request && preparedDownload.format === downloadFormat;

    useEffect(() => setMobileSharing(supportsMobileShare(navigator)), []);

    useEffect(() => {
        if (!mobileSharing || !previewCurrent || !preview) {
            setPreparedDownload(null);
            return;
        }
        let cancelled = false;
        // Web Share requires user activation. Do conversion ahead of the tap,
        // and key the file to both QR settings and format to avoid stale exports.
        exportQRImage(preview.blob, size, downloadFormat)
            .then((blob) => {
                if (!cancelled) setPreparedDownload({ request, format: downloadFormat,
                    file: new File([blob], `qrcode.${downloadFormat}`, { type: blob.type }) });
            })
            .catch(() => {
                // Let the normal export handler retry and report any error.
                if (!cancelled) setPreparedDownload({ request, format: downloadFormat, file: null });
            });
        return () => { cancelled = true; };
    }, [mobileSharing, previewCurrent, preview, request, size, downloadFormat]);

    useEffect(() => {
        let cancelled = false;
        import("qr-code-styling")
            .then((mod) => {
                if (cancelled) return;
                const render = createQRRenderer(mod.default);
                imageSourceRef.current = createQRImageSource(async (options: QRRequest, isCurrent: () => boolean) => {
                    const { logo, corners, ...qrOptions } = options;
                    const rendered = await render(qrOptions, isCurrent);
                    if (!rendered) return rendered;
                    const blob = await styleQRCorners(rendered, corners);
                    if (!logo) return blob;
                    return addLogoOverlay(blob, logo, options.width!, options.margin!, options.backgroundOptions!.color!);
                });
                setRendererReady(true);
            })
            .catch(() => {
                if (!cancelled) setQrLoadError("Unable to load the QR renderer. Please refresh and try again.");
            });
        return () => {
            cancelled = true;
            imageSourceRef.current = null;
            logoRequestRef.current += 1;
        };
    }, []);

    const getImage = useCallback((retain = false) => {
        if (!imageSourceRef.current) return Promise.reject(new Error("The QR renderer is not ready."));
        return imageSourceRef.current(request, () => {
            if (!layout) throw new Error(layoutError || "Could not calculate the QR layout.");
            return { ...request, margin: layout.margin, qrOptions: { ...request.qrOptions, mode: layout.mode } };
        }, retain);
    }, [request, layout, layoutError]);

    useEffect(() => {
        let cancelled = false;
        setRenderError(null);
        setDownloadError(null);
        if (!normalizedUrl) {
            setPreview(null);
            return;
        }
        if (!rendererReady) return;
        const render = async () => {
            let previewUrl: string | undefined;
            try {
                const blob = await getImage();
                if (cancelled) return;
                previewUrl = URL.createObjectURL(blob);
                // Decode before replacing the visible image to avoid a blank frame.
                await loadImage(previewUrl);
                if (cancelled) {
                    URL.revokeObjectURL(previewUrl);
                    return;
                }
                setPreview({ request, blob, url: previewUrl });
            } catch (error) {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                if (!cancelled) {
                    setPreview(null);
                    setRenderError(error instanceof Error ? error.message : "Could not generate the QR code. Try changing the settings or removing the logo.");
                }
            }
        };
        void render();
        return () => { cancelled = true; };
    }, [request, rendererReady, normalizedUrl, getImage]);

    useEffect(() => {
        // Keep the old image URL alive until its replacement is displayed.
        return () => { if (preview) URL.revokeObjectURL(preview.url); };
    }, [preview]);

    const handleLogoFile = useCallback(async (file: File) => {
        const logoRequest = ++logoRequestRef.current;
        setLogoLoading(false);
        setLogoError(null);
        if (!file.type.startsWith("image/")) {
            setLogoError("Logo must be an image file.");
            return;
        }
        setLogoLoading(true);
        try {
            const source = await prepareLogo(file);
            if (logoRequest !== logoRequestRef.current) return;
            setLogoSource(source);
            setLogoName(file.name);
        } catch (error) {
            if (logoRequest === logoRequestRef.current) setLogoError(error instanceof Error && error.message.includes("fully transparent")
                ? error.message : "Could not read this logo. Try a valid PNG, JPEG, WebP, or SVG image.");
        } finally {
            if (logoRequest === logoRequestRef.current) setLogoLoading(false);
        }
    }, []);

    const removeLogo = useCallback(() => {
        logoRequestRef.current += 1;
        setLogoLoading(false);
        setLogoSource(null);
        setLogoName(null);
        setLogoError(null);
    }, []);

    const handleDownload = async () => {
        if (!canDownload || (mobileSharing && !downloadPrepared)) return;
        setDownloading(true);
        setDownloadError(null);
        try {
            if (mobileSharing && downloadPrepared && preparedDownload.file) {
                // No asynchronous work before saveQRFile opens the share sheet.
                await saveQRFile(preparedDownload.file, navigator, downloadQRImage);
                return;
            }
            // Keep the settings selected at click time, even if another edit follows.
            const blob = await exportQRImage(await getImage(true), size, downloadFormat);
            downloadQRImage(blob, `qrcode.${downloadFormat}`);
        } catch {
            setDownloadError("Could not export the QR code. Please try again or choose another format.");
        } finally {
            setDownloading(false);
        }
    };

    const handleCopy = async () => {
        if (!canDownload || copying) return;
        setCopyState({ request, status: "copying" });
        try {
            await copyQRImage(getImage(true), size);
            setCopyState({ request, status: "copied" });
        } catch (error) {
            setCopyState({ request, status: "error", message:
                error instanceof Error && error.message.includes("not supported") ? error.message
                    : "Could not copy the image. Check your browser’s clipboard permission or download it instead." });
        }
    };

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
                        placeholder="Enter a website..."
                    />
                </div>

                <CollapsibleSection label="Colors">
                    <div className="qr-colors">
                        <label className="ui-field" htmlFor="qr-fg">
                            <span className="ui-label">Foreground</span>
                            <div className="ui-color-field">
                                <input id="qr-fg" className="ui-color-input" type="color" value={fgColor} onChange={(e) => { setFgColor(e.target.value); setFgDraft(e.target.value); }} />
                                <input
                                    aria-label="Foreground color hex"
                                    className="ui-input qr-color-value"
                                    type="text"
                                    value={fgDraft}
                                    aria-invalid={!isHexColor(fgDraft)}
                                    aria-describedby={!colorsValid ? "qr-color-error" : undefined}
                                    onChange={(e) => { setFgDraft(e.target.value); if (isHexColor(e.target.value)) setFgColor(e.target.value); }}
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
                            onClick={() => { setFgColor(bgColor); setFgDraft(bgColor); setBgColor(fgColor); setBgDraft(fgColor); }}
                        >
                            ⇅
                        </button>
                        <label className="ui-field" htmlFor="qr-bg">
                            <span className="ui-label">Background</span>
                            <div className="ui-color-field">
                                <input id="qr-bg" className="ui-color-input" type="color" value={bgColor} onChange={(e) => { setBgColor(e.target.value); setBgDraft(e.target.value); }} />
                                <input
                                    aria-label="Background color hex"
                                    className="ui-input qr-color-value"
                                    type="text"
                                    value={bgDraft}
                                    aria-invalid={!isHexColor(bgDraft)}
                                    aria-describedby={!colorsValid ? "qr-color-error" : undefined}
                                    onChange={(e) => { setBgDraft(e.target.value); if (isHexColor(e.target.value)) setBgColor(e.target.value); }}
                                    maxLength={7}
                                />
                            </div>
                        </label>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection label="Shapes">
                    <div className="ui-grid qr-shape-grid">
                        <ShapePicker<DotType> label="Dots" part="dots" value={dotType} onChange={setDotType}
                            options={[
                                { value: "square", label: "Square" },
                                { value: "rounded", label: "Round" },
                                { value: "dots", label: "Circular" },
                                { value: "classy", label: "Classy" },
                                { value: "classy-rounded", label: "Classy round" },
                                { value: "extra-rounded", label: "Extra round" },
                            ]} />
                        <ShapePicker<CornerType> label="Outer corners" part="outer" value={cornerSquareType} onChange={setCornerSquareType}
                            options={cornerOptions} />
                        <ShapePicker<CornerType> label="Inner corners" part="inner" value={cornerDotType} onChange={setCornerDotType}
                            options={cornerOptions} />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection label="Border">
                    <div className="ui-stack">
                        <label className="ui-field" htmlFor="qr-border-spacing">
                            <span className="ui-label">Border spacing <span className="ui-muted">{borderSpacing}%</span></span>
                            <input id="qr-border-spacing" className="ui-range" type="range" min={0} max={20} step={1}
                                value={borderSpacing} onChange={(event) => setBorderSpacing(Number(event.target.value))}
                                aria-valuetext={`${borderSpacing}% of download size per side`} />
                        </label>
                        <label className="ui-field" htmlFor="qr-border-radius">
                            <span className="ui-label">Corner radius <span className="ui-muted">{effectiveBorderRadius}%</span></span>
                            <input id="qr-border-radius" className="ui-range" type="range" min={0} max={maxBorderRadius} step={1}
                                value={effectiveBorderRadius} disabled={maxBorderRadius === 0}
                                onChange={(event) => setBorderRadius(Number(event.target.value))}
                                aria-valuetext={`${effectiveBorderRadius}% of download size; maximum ${maxBorderRadius}% at this spacing`} />
                        </label>
                        {effectiveBorderRadius > 0 && <p className="ui-hint">Round corners are transparent in PNG and SVG. JPEG fills them with white.</p>}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection label="Logo">
                    <ImageInput
                        onFile={handleLogoFile}
                        dragging={dragging}
                        onDraggingChange={setDragging}
                        title="Choose a logo"
                        formats={["PNG", "JPEG", "WebP", "SVG"]}
                        fileName={logoName}
                        previewUrl={logoDataUrl}
                        previewAlt="Logo preview"
                        onRemove={removeLogo}
                        loading={logoLoading}
                        loadingLabel="Processing logo…"
                    />
                    <ErrorMessage message={logoError} />
                    {logoSource && <LogoControls settings={logoSettings} background={bgColor} onChange={setLogoSettings} />}
                </CollapsibleSection>

                <CollapsibleSection label="Advanced">
                    <div className="ui-field">
                        <div className="qr-label-with-help">
                            <label className="ui-label" htmlFor="qr-ec">Error correction</label>
                            <ErrorCorrectionHelp />
                        </div>
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
                    </div>
                </CollapsibleSection>
            </section>

            <aside className="qr-preview-panel ui-panel ui-stack" data-elevation="raised" aria-label="QR code preview">
                <span className="ui-section-label">Preview</span>
                <div
                    className="qr-preview-frame"
                    data-empty={String(!showPreview)}
                    aria-busy={!!normalizedUrl && !previewCurrent && !renderError && !qrLoadError}
                    style={{ borderRadius: `${effectiveBorderRadius}%` }}
                >
                    {showPreview && preview && (
                        <img
                            src={preview.url}
                            className="qr-preview-image"
                            alt="Generated QR code"
                            onError={() => setRenderError("Could not display the QR code. Try changing the settings or removing the logo.")}
                        />
                    )}
                    {!showPreview && (!normalizedUrl || renderError || qrLoadError) && <p className="qr-placeholder" role="status">{
                        !normalizedUrl ? "Enter a website to generate a QR code."
                            : "Preview unavailable."
                    }</p>}
                </div>
                <div className="qr-quality">
                    <label className="ui-sr-only" htmlFor="qr-quality">Quality</label>
                    <input id="qr-quality" className="ui-range qr-quality-slider" type="range"
                        min={200} max={2000} step={100} value={size}
                        onChange={(event) => setSize(Number(event.target.value))}
                        aria-valuetext={`${size} by ${size} pixels`} />
                    <div className="qr-quality-scale" aria-hidden="true">
                        <span>Low Quality</span>
                        <output htmlFor="qr-quality">{size} × {size} px</output>
                        <span>High Quality</span>
                    </div>
                </div>
                <ErrorMessage message={qrLoadError || renderError || downloadError || copyError} style={{ textAlign: "center", maxWidth: 320 }} />
                {!colorsValid && <p id="qr-color-error" className="ui-alert" data-variant="danger" role="alert">Enter a full six-digit hex color, such as #1a2b3c. The preview keeps the last valid colors.</p>}
                <QRScanSafeguards foreground={fgColor} background={bgColor} enabled={colorsValid && !!normalizedUrl}
                    image={previewCurrent && showPreview && !logoLoading ? preview.blob : null} size={size} content={normalizedUrl} />
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
                    <div className="qr-export-buttons">
                        <DownloadButton
                            onClick={handleDownload}
                            filename={`qrcode.${downloadFormat}`}
                            disabled={!canDownload || (mobileSharing && !downloadPrepared)}
                        />
                        <button type="button" className="ui-button" data-variant="secondary"
                            onClick={handleCopy} disabled={!canDownload || copying} title="Copy QR code as a PNG image"
                            aria-label={copied ? "Copied!" : "Copy"}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <rect x="8" y="8" width="12" height="12" rx="2" />
                                <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                            </svg>
                            <span className="qr-copy-label" aria-hidden="true">
                                <span style={{ visibility: copied ? "hidden" : "visible" }}>Copy</span>
                                <span style={{ visibility: copied ? "visible" : "hidden" }}>Copied!</span>
                            </span>
                        </button>
                    </div>
                </div>
                <span className="ui-sr-only" role="status">{copied ? "QR code image copied to clipboard." : ""}</span>
            </aside>
        </div>
    );
}
