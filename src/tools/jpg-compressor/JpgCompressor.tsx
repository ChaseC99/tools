import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import DownloadButton from "@tools/shared/DownloadButton";
import ErrorMessage from "@tools/shared/ErrorMessage";
import ImageDropZone from "@tools/shared/ImageDropZone";
import Spinner from "@tools/shared/Spinner";

import JpgCompressionWorker from "./jpgCompression.worker?worker";
import type { JpgCompressionWorkerRequest, JpgCompressionWorkerResponse } from "./workerProtocol";

type CompressionResult = {
    byteLength: number;
    blob: Blob;
    filename: string;
    metTarget: boolean;
    quality: number;
    url: string;
};

type LoadedSource = {
    baseName: string;
    file: File;
    height: number | null;
    previewUrl: string;
    sourceId: number;
    width: number | null;
};

type PendingSource = {
    baseName: string;
    file: File;
    previewUrl: string;
    sourceId: number;
};

type ComparePreviewProps = {
    comparePosition: number;
    compressedUrl: string | null;
    isMobile: boolean;
    loading: boolean;
    loadingMessage: string;
    onComparePositionChange: (value: number) => void;
    originalUrl: string | null;
};

const DEFAULT_TARGET_KB = 800;
const MIN_QUALITY = 10;
const MAX_QUALITY = 100;
const TARGET_LIMIT_KB = 10240;
const MANUAL_COMPRESSION_DEBOUNCE_MS = 250;
const BYTES_PER_KB = 1000;
const BYTES_PER_MB = 1000 * 1000;
const COMPARE_ZOOM_SCALE = 4;
const MOBILE_BREAKPOINT = 720;

function isJpegFile(file: File): boolean {
    return file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
}

function parsePositiveInteger(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return null;
    return parsed;
}

function clampTargetKb(value: number): number {
    return Math.min(TARGET_LIMIT_KB, Math.max(1, Math.round(value)));
}

function clampPercentage(value: number): number {
    return Math.min(100, Math.max(0, value));
}

function formatBytes(bytes: number): string {
    if (bytes >= BYTES_PER_MB) {
        return `${(bytes / BYTES_PER_MB).toFixed(bytes >= 10 * BYTES_PER_MB ? 1 : 2)} MB`;
    }

    if (bytes >= BYTES_PER_KB) {
        return `${(bytes / BYTES_PER_KB).toFixed(bytes >= 100 * BYTES_PER_KB ? 0 : 1)} KB`;
    }

    return `${bytes} bytes`;
}

function formatDelta(originalBytes: number, compressedBytes: number): string {
    if (originalBytes <= 0) return "";

    const ratio = ((compressedBytes - originalBytes) / originalBytes) * 100;
    if (Math.abs(ratio) < 0.05) return "About the same size";
    if (ratio < 0) return `${Math.abs(ratio).toFixed(1)}% smaller`;
    return `${ratio.toFixed(1)}% larger`;
}

function getFrameAspectRatio(width: number | null, height: number | null): string {
    if (width && height) {
        return `${width} / ${height}`;
    }

    return "4 / 3";
}

const styles: Record<string, CSSProperties> = {
    page: {
        maxWidth: 1040,
        margin: "0 auto",
        padding: "1rem",
    },
    pageCard: {
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 20,
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
        padding: "1.25rem",
    },
    pageBody: {
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
    },
    intro: {
        margin: 0,
        color: "#475569",
        lineHeight: 1.6,
    },
    introLink: {
        color: "#2563eb",
        fontWeight: 600,
        textDecoration: "none",
    },

    uploadDropzone: {
        padding: "2rem",
        background: "transparent",
        border: "2px dashed #94a3b8",
    },
    uploadDropzoneSelected: {
        padding: "0.75rem",
    },
    uploadDropzoneDragging: {
        background: "rgba(59, 130, 246, 0.06)",
        border: "2px dashed #60a5fa",
    },
    uploadRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
    },
    uploadFilename: {
        margin: 0,
        color: "#334155",
        fontSize: "0.95rem",
        textAlign: "left",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    uploadReplaceButton: {
        pointerEvents: "none",
        border: "1px solid #d0d8e5",
        borderRadius: 10,
        color: "#2f5c9a",
        background: "#f8fafc",
        padding: "0.35rem 0.8rem",
        fontSize: "0.85rem",
        fontWeight: 600,
        flexShrink: 0,
    },
    uploadEmptyText: {
        margin: 0,
        color: "#475569",
        fontSize: "0.95rem",
        lineHeight: 1.6,
        wordBreak: "break-word",
    },

    sectionCard: {
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 18,
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
    },
    controlsCard: {
        display: "flex",
        gap: "1rem",
        alignItems: "end",
        borderRadius: 14,
        padding: "1rem",
    },
    controlsCardMobile: {
        flexDirection: "column",
        alignItems: "stretch",
    },
    targetLabel: {
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
    },
    targetLabelText: {
        color: "#162033",
        fontSize: "0.95rem",
        fontWeight: 600,
    },
    targetInputShell: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        background: "#f8fbff",
        border: "1px solid #cad6e2",
        borderRadius: 10,
        padding: "0.65rem 0.8rem",
    },
    targetInput: {
        width: "100%",
        border: "none",
        background: "transparent",
        color: "#162033",
        fontSize: "1rem",
        outline: "none",
    },
    targetUnit: {
        color: "#64748b",
        fontSize: "0.9rem",
    },
    targetHelp: {
        color: "#64748b",
        fontSize: "0.92rem",
        lineHeight: 1.55,
    },

    resultsRow: {
        display: "flex",
        gap: "1rem",
        alignItems: "stretch",
    },
    resultsRowMobile: {
        flexDirection: "column",
    },
    resultCard: {
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 18,
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
        padding: "1.1rem",
        display: "flex",
        flexDirection: "column",
        flex: "1 1 0",
        gap: "0.9rem",
        minHeight: "100%",
    },
    resultCardMobile: {
        flex: "0 0 auto",
        minHeight: 0,
    },
    cardHeader: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "0.5rem",
    },
    cardHeaderRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "0.75rem",
    },
    cardHeaderRowMobile: {
        flexWrap: "wrap",
    },
    cardTitle: {
        margin: 0,
        fontSize: "1.15rem",
        color: "#162033",
    },
    cardTitleCompact: {
        fontSize: "1rem",
    },
    cardSubtitle: {
        margin: 0,
        color: "#66758f",
        fontSize: "0.9rem",
        lineHeight: 1.4,
    },
    statusPill: {
        padding: "0.35rem 0.7rem",
        borderRadius: 999,
        fontSize: "0.82rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
    },
    statusPillMobile: {
        maxWidth: "100%",
        whiteSpace: "normal",
    },
    statusPillSuccess: {
        background: "rgba(34, 197, 94, 0.12)",
        color: "#15803d",
    },
    statusPillWarning: {
        background: "rgba(250, 204, 21, 0.14)",
        color: "#b45309",
    },

    mediaFrame: {
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: "#edf3fa",
        border: "1px solid #d9e2ec",
    },
    mediaFrameSkeleton: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#edf3fa",
    },
    mediaImage: {
        display: "block",
        width: "100%",
        height: "auto",
        maxWidth: "100%",
        background: "#edf3fa",
    },
    mediaSkeletonSizingImage: {
        display: "block",
        width: "100%",
        height: "auto",
        maxWidth: "100%",
        opacity: 0,
        pointerEvents: "none",
        userSelect: "none",
    },
    mediaSkeletonOverlay: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#edf3fa",
    },
    compareCard: {
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 18,
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        marginTop: "0.35rem",
    },
    compareDescription: {
        margin: "0.25rem 0 0",
        color: "#64748b",
        lineHeight: 1.5,
    },
    compareLabels: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        color: "#64748b",
        fontSize: "0.85rem",
        fontWeight: 600,
    },
    compareFrame: {
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: "#edf3fa",
        border: "1px solid #d9e2ec",
        touchAction: "none",
        userSelect: "none",
        height: 360,
    },
    compareFrameMobile: {
        height: 280,
    },
    compareFrameInteractive: {
        cursor: "ew-resize",
    },
    compareFrameStatic: {
        cursor: "default",
    },
    compareImage: {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        background: "#edf3fa",
        transform: `scale(${COMPARE_ZOOM_SCALE})`,
        transformOrigin: "center",
    },
    compareLoadingOverlay: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#edf3fa",
    },
    compareCompressedMask: {
        position: "absolute",
        inset: 0,
        overflow: "hidden",
    },
    compareHandleWrap: {
        position: "absolute",
        top: 0,
        bottom: 0,
        transform: "translateX(-50%)",
        pointerEvents: "none",
    },
    compareHandleRail: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        width: 2,
        transform: "translateX(-50%)",
        background: "rgba(255, 255, 255, 0.96)",
        boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.06)",
    },
    compareHandleKnob: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 42,
        height: 42,
        borderRadius: "999px",
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        boxShadow: "0 12px 24px rgba(15, 23, 42, 0.16)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#334155",
        fontSize: "1.1rem",
        fontWeight: 700,
    },
    compareHandleGlyph: {
        letterSpacing: "-0.2em",
        transform: "translateX(-1px)",
    },

    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "0.85rem",
    },
    statsGridMobile: {
        gridTemplateColumns: "1fr",
    },
    statLabel: {
        color: "#6b7b95",
        fontSize: "0.8rem",
        marginBottom: "0.15rem",
    },
    statValue: {
        color: "#162033",
        fontWeight: 600,
    },
    statValueWrap: {
        wordBreak: "break-word",
    },
    footerRow: {
        marginTop: "auto",
        display: "flex",
        gap: "0.75rem",
        flexWrap: "wrap",
        alignItems: "center",
        paddingTop: "0.25rem",
    },
    subtleButton: {
        padding: "0.6rem 1rem",
        borderRadius: 10,
        border: "1px solid #c8d4e3",
        background: "#ffffff",
        color: "#162033",
        cursor: "pointer",
        fontSize: "0.95rem",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
    },
    warningCallout: {
        margin: 0,
        padding: "0.8rem 0.9rem",
        borderRadius: 12,
        background: "rgba(250, 204, 21, 0.12)",
        color: "#92400e",
        lineHeight: 1.5,
    },

    manualCard: {
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 18,
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
    },
    manualDescription: {
        margin: "0.25rem 0 0",
        color: "#64748b",
        lineHeight: 1.5,
    },
    manualRow: {
        display: "flex",
        gap: "0.9rem",
        alignItems: "center",
        flexWrap: "wrap",
    },
    manualField: {
        display: "flex",
        alignItems: "center",
        gap: "0.85rem",
        flex: "1 1 320px",
    },
    manualFieldMobile: {
        alignItems: "stretch",
        flexDirection: "column",
    },
    manualLabel: {
        color: "#162033",
        minWidth: 92,
        fontWeight: 600,
    },
    manualValue: {
        minWidth: 32,
        textAlign: "right",
        color: "#162033",
    },
    manualSlider: {
        flex: 1,
        accentColor: "#2563eb",
    },

    skeletonContent: {
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        color: "#475569",
        padding: "0 1rem",
        textAlign: "center",
    },
    skeletonLine: {
        height: 18,
        borderRadius: 999,
        background: "#dbe7f3",
    },
    skeletonButtonShell: {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.55rem 1rem",
        borderRadius: 8,
        border: "1px solid #d9e2ec",
        background: "#f8fbff",
    },
    skeletonButtonIcon: {
        width: 20,
        height: 20,
        borderRadius: 6,
        background: "#dbe7f3",
        flexShrink: 0,
    },
    skeletonButtonLabel: {
        width: 74,
        height: 18,
        borderRadius: 999,
        background: "#dbe7f3",
    },
};

function ComparePreview({
    comparePosition,
    compressedUrl,
    isMobile,
    loading,
    loadingMessage,
    onComparePositionChange,
    originalUrl,
}: ComparePreviewProps) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const isInteractive = Boolean(compressedUrl && !loading);

    const updateFromClientX = useCallback(
        (clientX: number) => {
            const frame = frameRef.current;
            if (!frame) return;

            const bounds = frame.getBoundingClientRect();
            if (bounds.width <= 0) return;

            const nextPosition = ((clientX - bounds.left) / bounds.width) * 100;
            onComparePositionChange(clampPercentage(nextPosition));
        },
        [onComparePositionChange],
    );

    const handlePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!isInteractive) return;

            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromClientX(event.clientX);
        },
        [isInteractive, updateFromClientX],
    );

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!isInteractive || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            updateFromClientX(event.clientX);
        },
        [isInteractive, updateFromClientX],
    );

    const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }, []);

    const compareFrameStyle = {
        ...styles.compareFrame,
        ...(isMobile ? styles.compareFrameMobile : {}),
        ...(isInteractive ? styles.compareFrameInteractive : styles.compareFrameStatic),
    };
    const compareMaskStyle = {
        ...styles.compareCompressedMask,
        clipPath: `inset(0 0 0 ${comparePosition}%)`,
    };
    const compareHandleWrapStyle = {
        ...styles.compareHandleWrap,
        left: `${comparePosition}%`,
    };

    return (
        <section style={styles.compareCard}>
            <div>
                <h2 style={{ ...styles.cardTitle, ...styles.cardTitleCompact }}>Compare preview</h2>
                <p style={styles.compareDescription}>
                    Drag the divider to compare the original image against the current compressed preview.
                </p>
            </div>

            <div style={styles.compareLabels}>
                <span>Original</span>
                <span>Compressed</span>
            </div>

            <div
                ref={frameRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={compareFrameStyle}
            >
                {originalUrl && <img src={originalUrl} alt="Original JPG for comparison" style={styles.compareImage} />}

                {loading || !compressedUrl ? (
                    <div style={styles.compareLoadingOverlay}>
                        <div style={styles.skeletonContent}>
                            <Spinner size={20} color="#2563eb" />
                            <span>{loadingMessage}</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={compareMaskStyle}>
                            <img src={compressedUrl} alt="Compressed JPG for comparison" style={styles.compareImage} />
                        </div>

                        <div style={compareHandleWrapStyle}>
                            <div style={styles.compareHandleRail} />
                            <div style={styles.compareHandleKnob}>
                                <span style={styles.compareHandleGlyph}>&lt;&gt;</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}

export default function JpgCompressor() {
    const workerRef = useRef<Worker | null>(null);
    const sourceRef = useRef<LoadedSource | null>(null);
    const nextRequestIdRef = useRef(1);
    const activeSourceIdRef = useRef<number | null>(null);
    const latestLoadRequestIdRef = useRef<number | null>(null);
    const latestAutoRequestIdRef = useRef<number | null>(null);
    const latestManualRequestIdRef = useRef<number | null>(null);
    const pendingSourceRef = useRef<PendingSource | null>(null);

    const [dragging, setDragging] = useState(false);
    const [loadingSource, setLoadingSource] = useState(false);
    const [source, setSource] = useState<LoadedSource | null>(null);
    const [targetKb, setTargetKb] = useState(DEFAULT_TARGET_KB);
    const [targetInput, setTargetInput] = useState(String(DEFAULT_TARGET_KB));
    const [inputError, setInputError] = useState<string | null>(null);
    const [autoError, setAutoError] = useState<string | null>(null);
    const [manualError, setManualError] = useState<string | null>(null);
    const [autoPending, setAutoPending] = useState(false);
    const [autoResult, setAutoResult] = useState<CompressionResult | null>(null);
    const [sliderQuality, setSliderQuality] = useState<number | null>(null);
    const [manualQuality, setManualQuality] = useState<number | null>(null);
    const [manualResult, setManualResult] = useState<CompressionResult | null>(null);
    const [comparePosition, setComparePosition] = useState(50);
    const [selectedFileLabel, setSelectedFileLabel] = useState("");
    const [isMobile, setIsMobile] = useState(false);

    const getNextRequestId = useCallback(() => {
        const requestId = nextRequestIdRef.current;
        nextRequestIdRef.current += 1;
        return requestId;
    }, []);

    const postWorkerMessage = useCallback((message: JpgCompressionWorkerRequest) => {
        workerRef.current?.postMessage(message);
    }, []);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    useEffect(() => {
        sourceRef.current = source;
    }, [source]);

    useEffect(() => {
        const worker = new JpgCompressionWorker();
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<JpgCompressionWorkerResponse>) => {
            const message = event.data;

            switch (message.type) {
                case "source-loaded": {
                    if (
                        latestLoadRequestIdRef.current !== message.requestId ||
                        activeSourceIdRef.current !== message.sourceId
                    ) {
                        return;
                    }

                    const pendingSource = pendingSourceRef.current;
                    if (!pendingSource || pendingSource.sourceId !== message.sourceId) {
                        return;
                    }

                    setLoadingSource(false);
                    setInputError(null);
                    setSource({
                        baseName: message.baseName,
                        file: pendingSource.file,
                        height: message.height,
                        previewUrl: pendingSource.previewUrl,
                        sourceId: message.sourceId,
                        width: message.width,
                    });
                    pendingSourceRef.current = null;
                    return;
                }

                case "auto-compressed": {
                    if (
                        latestAutoRequestIdRef.current !== message.requestId ||
                        activeSourceIdRef.current !== message.sourceId
                    ) {
                        return;
                    }

                    setAutoPending(false);
                    setAutoError(null);
                    setAutoResult({
                        blob: message.result.blob,
                        byteLength: message.result.byteLength,
                        filename: `${sourceRef.current?.baseName ?? "image"}-compressed.jpg`,
                        metTarget: message.result.metTarget,
                        quality: message.result.quality,
                        url: URL.createObjectURL(message.result.blob),
                    });
                    return;
                }

                case "manual-compressed": {
                    if (
                        latestManualRequestIdRef.current !== message.requestId ||
                        activeSourceIdRef.current !== message.sourceId
                    ) {
                        return;
                    }

                    setManualError(null);
                    setManualResult({
                        blob: message.result.blob,
                        byteLength: message.result.byteLength,
                        filename: `${sourceRef.current?.baseName ?? "image"}-compressed.jpg`,
                        metTarget: message.result.metTarget,
                        quality: message.result.quality,
                        url: URL.createObjectURL(message.result.blob),
                    });
                    return;
                }

                case "error": {
                    if (activeSourceIdRef.current !== message.sourceId) {
                        return;
                    }

                    if (message.stage === "load-source" && latestLoadRequestIdRef.current === message.requestId) {
                        const pendingSource = pendingSourceRef.current;
                        if (pendingSource?.previewUrl && pendingSource.previewUrl !== sourceRef.current?.previewUrl) {
                            URL.revokeObjectURL(pendingSource.previewUrl);
                        }

                        pendingSourceRef.current = null;
                        setLoadingSource(false);
                        setSource(null);
                        setInputError(message.message);
                    }

                    if (message.stage === "auto-compress" && latestAutoRequestIdRef.current === message.requestId) {
                        setAutoPending(false);
                        setAutoResult(null);
                        setAutoError(message.message);
                    }

                    if (message.stage === "manual-compress" && latestManualRequestIdRef.current === message.requestId) {
                        setManualResult(null);
                        setManualError(message.message);
                    }

                    return;
                }

                default:
                    return;
            }
        };

        return () => {
            if (pendingSourceRef.current?.previewUrl && pendingSourceRef.current.previewUrl !== sourceRef.current?.previewUrl) {
                URL.revokeObjectURL(pendingSourceRef.current.previewUrl);
            }

            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    useEffect(() => {
        return () => {
            if (source?.previewUrl) {
                URL.revokeObjectURL(source.previewUrl);
            }
        };
    }, [source?.previewUrl]);

    useEffect(() => {
        return () => {
            if (autoResult?.url) {
                URL.revokeObjectURL(autoResult.url);
            }
        };
    }, [autoResult?.url]);

    useEffect(() => {
        return () => {
            if (manualResult?.url) {
                URL.revokeObjectURL(manualResult.url);
            }
        };
    }, [manualResult?.url]);

    const resetManualState = useCallback(() => {
        setSliderQuality(null);
        setManualQuality(null);
        setManualError(null);
        setManualResult(null);
    }, []);

    useEffect(() => {
        setComparePosition(50);
    }, [source?.previewUrl]);

    const handleFile = useCallback(
        (file: File, options?: { replaceExisting?: boolean }) => {
            const replaceExisting = options?.replaceExisting ?? false;
            setDragging(false);
            setInputError(null);
            setAutoError(null);
            setAutoPending(false);
            setAutoResult(null);
            resetManualState();

            if (pendingSourceRef.current?.previewUrl && pendingSourceRef.current.previewUrl !== sourceRef.current?.previewUrl) {
                URL.revokeObjectURL(pendingSourceRef.current.previewUrl);
            }

            pendingSourceRef.current = null;
            activeSourceIdRef.current = null;
            latestLoadRequestIdRef.current = null;
            latestAutoRequestIdRef.current = null;
            latestManualRequestIdRef.current = null;

            if (replaceExisting) {
                setSource(null);
            }

            if (!isJpegFile(file)) {
                setSelectedFileLabel("");
                setLoadingSource(false);
                setSource(null);
                setInputError("This first version is JPG-only. Please choose a .jpg or .jpeg image.");
                return;
            }

            const previewUrl = URL.createObjectURL(file);
            const baseName = file.name.replace(/\.[^.]+$/, "");
            const sourceId = getNextRequestId();
            const requestId = getNextRequestId();
            const pendingSource = {
                baseName,
                file,
                previewUrl,
                sourceId,
            };

            activeSourceIdRef.current = sourceId;
            latestLoadRequestIdRef.current = requestId;
            pendingSourceRef.current = pendingSource;
            setSelectedFileLabel(file.name);
            setLoadingSource(true);

            if (!replaceExisting) {
                setSource({
                    baseName,
                    file,
                    height: null,
                    previewUrl,
                    sourceId,
                    width: null,
                });
            }

            postWorkerMessage({
                file,
                requestId,
                sourceId,
                type: "load-source",
            });
        },
        [getNextRequestId, postWorkerMessage, resetManualState],
    );

    const commitTargetValue = useCallback(
        (nextTarget: number) => {
            const normalized = clampTargetKb(nextTarget);
            setTargetKb(normalized);
            setTargetInput(String(normalized));
            resetManualState();
        },
        [resetManualState],
    );

    const handleTargetInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const nextValue = event.target.value;
            setTargetInput(nextValue);

            const parsed = parsePositiveInteger(nextValue);
            if (parsed !== null) {
                commitTargetValue(parsed);
            }
        },
        [commitTargetValue],
    );

    const handleTargetBlur = useCallback(() => {
        const parsed = parsePositiveInteger(targetInput);
        commitTargetValue(parsed ?? targetKb);
    }, [commitTargetValue, targetInput, targetKb]);

    useEffect(() => {
        if (!source || source.width === null || source.height === null) return;

        const requestId = getNextRequestId();
        latestAutoRequestIdRef.current = requestId;
        setAutoPending(true);
        setAutoError(null);
        setAutoResult(null);

        postWorkerMessage({
            maxQuality: MAX_QUALITY,
            minQuality: MIN_QUALITY,
            requestId,
            sourceId: source.sourceId,
            targetBytes: targetKb * BYTES_PER_KB,
            type: "auto-compress",
        });
    }, [getNextRequestId, postWorkerMessage, source, targetKb]);

    useEffect(() => {
        if (!autoResult) return;
        if (sliderQuality === null) return;

        if (sliderQuality === autoResult.quality) {
            resetManualState();
            return;
        }

        const timer = window.setTimeout(() => {
            setManualError(null);
            setManualQuality(sliderQuality);
        }, MANUAL_COMPRESSION_DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timer);
        };
    }, [autoResult, resetManualState, sliderQuality]);

    useEffect(() => {
        if (!source || source.width === null || source.height === null || manualQuality === null) return;

        const requestId = getNextRequestId();
        latestManualRequestIdRef.current = requestId;
        setManualError(null);
        setManualResult(null);

        postWorkerMessage({
            quality: manualQuality,
            requestId,
            sourceId: source.sourceId,
            targetBytes: targetKb * BYTES_PER_KB,
            type: "manual-compress",
        });
    }, [getNextRequestId, manualQuality, postWorkerMessage, source, targetKb]);

    const selectedQuality = sliderQuality ?? autoResult?.quality ?? null;
    const manualPreviewReady = selectedQuality !== null && manualResult?.quality === selectedQuality;
    const isManualPreviewPending = sliderQuality !== null && !manualPreviewReady;
    const activeResult = sliderQuality === null ? autoResult : manualPreviewReady ? manualResult : null;
    const displayedQuality = selectedQuality ?? activeResult?.quality ?? null;
    const resultStatus = activeResult
        ? activeResult.metTarget
            ? `Target met: ${formatBytes(activeResult.byteLength)}`
            : `Best effort: ${formatBytes(activeResult.byteLength)}`
        : null;

    const handleManualQualityChange = useCallback(
        (nextQuality: number) => {
            if (!autoResult) return;
            setSliderQuality(nextQuality);
        },
        [autoResult],
    );

    const compressedSubtitle = isManualPreviewPending
        ? "Updating preview..."
        : sliderQuality === null
          ? "Automatic result"
          : "Manual preview";
    const showSourceSkeleton = Boolean(loadingSource && !source);
    const showCompressedSkeleton = Boolean(showSourceSkeleton || (source && (autoPending || !activeResult)));
    const loadingMessage = loadingSource
        ? "Reading your JPG..."
        : isManualPreviewPending
          ? `Generating preview at quality ${sliderQuality}...`
          : "Finding the best quality for your target...";
    const mediaFrameLayoutStyle = {
        ...styles.mediaFrame,
        aspectRatio: getFrameAspectRatio(source?.width ?? null, source?.height ?? null),
    };
    const skeletonMediaFrameStyle = {
        ...styles.mediaFrame,
        ...styles.mediaFrameSkeleton,
        aspectRatio: getFrameAspectRatio(source?.width ?? null, source?.height ?? null),
    };
    const uploadDropzoneStyle = {
        ...styles.uploadDropzone,
        ...(selectedFileLabel ? styles.uploadDropzoneSelected : {}),
        ...(dragging ? styles.uploadDropzoneDragging : {}),
    };
    const controlsCardStyle = {
        ...styles.sectionCard,
        ...styles.controlsCard,
        ...(isMobile ? styles.controlsCardMobile : {}),
    };
    const resultsRowStyle = {
        ...styles.resultsRow,
        ...(isMobile ? styles.resultsRowMobile : {}),
    };
    const resultCardStyle = {
        ...styles.resultCard,
        ...(isMobile ? styles.resultCardMobile : {}),
    };
    const cardHeaderRowStyle = {
        ...styles.cardHeaderRow,
        ...(isMobile ? styles.cardHeaderRowMobile : {}),
    };
    const statsGridStyle = {
        ...styles.statsGrid,
        ...(isMobile ? styles.statsGridMobile : {}),
    };
    const manualFieldStyle = {
        ...styles.manualField,
        ...(isMobile ? styles.manualFieldMobile : {}),
    };
    const shouldShowResults = Boolean(source || showSourceSkeleton);

    return (
        <div style={styles.page}>
            <div style={styles.pageCard}>
                <div style={styles.pageBody}>
                    <p style={styles.intro}>
                        Reduce large JPGs toward a target size. For your privacy, all compression happens locally in your
                        browser. Your image is not uploaded to any server. This tool uses{" "}
                        <a href="https://github.com/mozilla/mozjpeg" target="_blank" rel="noopener noreferrer" style={styles.introLink}>
                            MozJPEG
                        </a>
                        .
                    </p>

                    <ImageDropZone
                        onFile={(file) => handleFile(file, { replaceExisting: Boolean(selectedFileLabel) })}
                        dragging={dragging}
                        onDraggingChange={setDragging}
                        accept="image/jpeg,.jpg,.jpeg"
                        theme="light"
                        style={uploadDropzoneStyle}
                    >
                        {selectedFileLabel ? (
                            <div style={styles.uploadRow}>
                                <p style={styles.uploadFilename}>{selectedFileLabel}</p>
                                <button type="button" style={styles.uploadReplaceButton}>
                                    Replace
                                </button>
                            </div>
                        ) : (
                            <p style={styles.uploadEmptyText}>Drop a JPG here or click to choose one.</p>
                        )}
                    </ImageDropZone>

                    <div style={controlsCardStyle}>
                        <label style={styles.targetLabel}>
                            <span style={styles.targetLabelText}>Target size</span>
                            <div style={styles.targetInputShell}>
                                <input
                                    type="number"
                                    min="1"
                                    max={TARGET_LIMIT_KB}
                                    step="1"
                                    value={targetInput}
                                    onChange={handleTargetInputChange}
                                    onBlur={handleTargetBlur}
                                    style={styles.targetInput}
                                />
                                <span style={styles.targetUnit}>KB</span>
                            </div>
                        </label>

                        <div style={styles.targetHelp}>
                            Searches for the highest JPEG quality that stays under your target.
                            <br />
                            If that is impossible without resizing, you still get the smallest best-effort JPG.
                        </div>
                    </div>

                    <ErrorMessage message={inputError} theme="light" />
                    <ErrorMessage message={autoError} theme="light" />
                    <ErrorMessage message={manualError} theme="light" />

                    {shouldShowResults && (
                        <div style={resultsRowStyle}>
                            <section style={resultCardStyle}>
                                <div style={styles.cardHeader}>
                                    <div style={cardHeaderRowStyle}>
                                        <h2 style={styles.cardTitle}>Original</h2>
                                    </div>
                                    <p style={styles.cardSubtitle}>{showSourceSkeleton ? "Preparing new JPG..." : "Selected JPG"}</p>
                                </div>

                                {showSourceSkeleton ? (
                                    <>
                                        <div style={skeletonMediaFrameStyle}>
                                            <div style={styles.skeletonContent}>
                                                <Spinner size={20} color="#2563eb" />
                                                <span>{loadingMessage}</span>
                                            </div>
                                        </div>

                                        <div style={statsGridStyle}>
                                            {["File size", "Dimensions"].map((label) => (
                                                <div key={label}>
                                                    <div style={styles.statLabel}>{label}</div>
                                                    <div style={styles.skeletonLine} />
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : source ? (
                                    <>
                                        <div style={mediaFrameLayoutStyle}>
                                            <img src={source.previewUrl} alt="Original JPG" style={styles.mediaImage} />
                                        </div>

                                        <div style={statsGridStyle}>
                                            <div>
                                                <div style={styles.statLabel}>File size</div>
                                                <div style={styles.statValue}>{formatBytes(source.file.size)}</div>
                                            </div>
                                            <div>
                                                <div style={styles.statLabel}>Dimensions</div>
                                                <div style={styles.statValue}>
                                                    {source.width && source.height ? `${source.width} × ${source.height}` : "Loading..."}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : null}
                            </section>

                            <section style={resultCardStyle}>
                                <div style={styles.cardHeader}>
                                    <div style={cardHeaderRowStyle}>
                                        <h2 style={styles.cardTitle}>Compressed</h2>
                                        {activeResult && (
                                            <div
                                                style={{
                                                    ...styles.statusPill,
                                                    ...(activeResult.metTarget ? styles.statusPillSuccess : styles.statusPillWarning),
                                                    ...(isMobile ? styles.statusPillMobile : {}),
                                                }}
                                            >
                                                {resultStatus}
                                            </div>
                                        )}
                                    </div>
                                    <p style={styles.cardSubtitle}>{showCompressedSkeleton ? loadingMessage : compressedSubtitle}</p>
                                </div>

                                {activeResult ? (
                                    <>
                                        <div style={mediaFrameLayoutStyle}>
                                            <img src={activeResult.url} alt="Compressed JPG" style={styles.mediaImage} />
                                        </div>

                                        <div style={statsGridStyle}>
                                            <div>
                                                <div style={styles.statLabel}>Compressed size</div>
                                                <div style={styles.statValue}>{formatBytes(activeResult.byteLength)}</div>
                                            </div>
                                            <div>
                                                <div style={styles.statLabel}>Change vs original</div>
                                                <div style={{ ...styles.statValue, ...styles.statValueWrap }}>
                                                    {formatDelta(source.file.size, activeResult.byteLength)}
                                                </div>
                                            </div>
                                            <div>
                                                <div style={styles.statLabel}>JPEG quality</div>
                                                <div style={styles.statValue}>{displayedQuality}</div>
                                            </div>
                                            <div>
                                                <div style={styles.statLabel}>Target</div>
                                                <div style={styles.statValue}>{targetKb} KB</div>
                                            </div>
                                        </div>

                                        {!activeResult.metTarget && (
                                            <p style={styles.warningCallout}>
                                                The target could not be reached without resizing, so this is the smallest best-effort JPG
                                                from the allowed quality range.
                                            </p>
                                        )}

                                        <div style={styles.footerRow}>
                                            <DownloadButton href={activeResult.url} filename={activeResult.filename} />
                                            {sliderQuality !== null && autoResult && (
                                                <button type="button" onClick={resetManualState} style={styles.subtleButton}>
                                                    Reset to auto ({autoResult.quality})
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={skeletonMediaFrameStyle}>
                                            {source?.previewUrl ? (
                                                <>
                                                    <img
                                                        src={source.previewUrl}
                                                        alt=""
                                                        aria-hidden="true"
                                                        style={styles.mediaSkeletonSizingImage}
                                                    />
                                                    <div style={styles.mediaSkeletonOverlay}>
                                                        <div style={styles.skeletonContent}>
                                                            <Spinner size={20} color="#2563eb" />
                                                            <span>{loadingMessage}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={styles.skeletonContent}>
                                                    <Spinner size={20} color="#2563eb" />
                                                    <span>{loadingMessage}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div style={statsGridStyle}>
                                            {["Compressed size", "Change vs original", "JPEG quality", "Target"].map((label) => (
                                                <div key={label}>
                                                    <div style={styles.statLabel}>{label}</div>
                                                    <div style={styles.skeletonLine} />
                                                </div>
                                            ))}
                                        </div>

                                        <div style={styles.footerRow}>
                                            <div style={styles.skeletonButtonShell}>
                                                <div style={styles.skeletonButtonIcon} />
                                                <div style={styles.skeletonButtonLabel} />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </section>
                        </div>
                    )}

                    {source && autoResult && (
                        <section style={styles.manualCard}>
                            <div>
                                <h2 style={{ ...styles.cardTitle, ...styles.cardTitleCompact }}>Manual fine-tuning</h2>
                                <p style={styles.manualDescription}>
                                    Auto compression picked quality {autoResult.quality}. Drag the slider if you want to trade a
                                    little more quality for size, or vice versa.
                                </p>
                            </div>

                            <div style={styles.manualRow}>
                                <label style={manualFieldStyle}>
                                    <span style={styles.manualLabel}>Quality</span>
                                    <input
                                        type="range"
                                        min={MIN_QUALITY}
                                        max={MAX_QUALITY}
                                        step="1"
                                        value={sliderQuality ?? autoResult.quality}
                                        onInput={(event) =>
                                            handleManualQualityChange(Number.parseInt((event.target as HTMLInputElement).value, 10))
                                        }
                                        onChange={(event) =>
                                            handleManualQualityChange(Number.parseInt(event.target.value, 10))
                                        }
                                        style={styles.manualSlider}
                                    />
                                    <strong style={styles.manualValue}>{displayedQuality}</strong>
                                </label>
                            </div>
                        </section>
                    )}

                    {shouldShowResults && (
                        <ComparePreview
                            comparePosition={comparePosition}
                            compressedUrl={activeResult?.url ?? null}
                            isMobile={isMobile}
                            loading={showCompressedSkeleton}
                            loadingMessage={loadingMessage}
                            onComparePositionChange={setComparePosition}
                            originalUrl={source?.previewUrl ?? null}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
