import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type ActiveTool = "pen" | "erase";
type Pattern = "none" | "dots" | "lines" | "grid";

const PRESET_COLORS = ["#111827", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"];

export default function Whiteboard() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef(false);
    const activePointerRef = useRef<number | null>(null);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const [activeTool, setActiveTool] = useState<ActiveTool>("pen");
    const [activePanel, setActivePanel] = useState<"pen" | "erase" | "background">("pen");
    const [penColor, setPenColor] = useState("#111827");
    const [penSize, setPenSize] = useState(4);
    const [eraserSize, setEraserSize] = useState(20);
    const [backgroundColor, setBackgroundColor] = useState("#ffffff");
    const [backgroundPattern, setBackgroundPattern] = useState<Pattern>("none");

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));

        if (canvas.width === width && canvas.height === height) return;

        const snapshot = document.createElement("canvas");
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        const snapshotCtx = snapshot.getContext("2d");
        if (snapshotCtx) {
            snapshotCtx.drawImage(canvas, 0, 0);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        if (snapshot.width > 0 && snapshot.height > 0) {
            ctx.drawImage(snapshot, 0, 0, width, height);
        }
    }, []);

    useEffect(() => {
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        return () => window.removeEventListener("resize", resizeCanvas);
    }, [resizeCanvas]);

    const getPoint = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    const applyStrokeStyle = (ctx: CanvasRenderingContext2D) => {
        if (activeTool === "erase") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
            ctx.lineWidth = eraserSize;
            return;
        }

        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penSize;
    };

    const drawLineTo = (point: { x: number; y: number }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const lastPoint = lastPointRef.current;
        if (!lastPoint) return;

        applyStrokeStyle(ctx);
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();

        lastPointRef.current = point;
    };

    const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const point = getPoint(event);
        if (!canvas || !point) return;

        event.preventDefault();
        try {
            canvas.setPointerCapture(event.pointerId);
        } catch {
            // Ignore unsupported pointer capture scenarios.
        }
        activePointerRef.current = event.pointerId;
        isDrawingRef.current = true;
        lastPointRef.current = point;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        applyStrokeStyle(ctx);
        ctx.beginPath();
        ctx.arc(point.x, point.y, (activeTool === "erase" ? eraserSize : penSize) / 2, 0, Math.PI * 2);
        ctx.fillStyle = activeTool === "erase" ? "rgba(0,0,0,1)" : penColor;
        ctx.fill();
    };

    const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        if (activePointerRef.current !== event.pointerId) return;
        event.preventDefault();
        const point = getPoint(event);
        if (!point) return;
        drawLineTo(point);
    };

    const stopDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        if (activePointerRef.current !== event.pointerId) return;
        const canvas = canvasRef.current;
        if (canvas?.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        isDrawingRef.current = false;
        activePointerRef.current = null;
        lastPointRef.current = null;
    };

    const clearBoard = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    };

    const backgroundImage = useMemo(() => {
        if (backgroundPattern === "dots") {
            return "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.18) 1px, transparent 1px)";
        }
        if (backgroundPattern === "lines") {
            return "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(0,0,0,0.14) 24px)";
        }
        if (backgroundPattern === "grid") {
            return "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)";
        }
        return "none";
    }, [backgroundPattern]);

    const backgroundSize = backgroundPattern === "dots" ? "24px 24px" : backgroundPattern === "none" ? "auto" : "24px 24px";

    return (
        <div style={styles.page}>
            <div
                style={{
                    ...styles.board,
                    backgroundColor,
                    backgroundImage,
                    backgroundSize,
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={styles.canvas}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                />
            </div>

            <div style={styles.toolbar}>
                <div style={styles.toolbarRow}>
                    <button
                        type="button"
                        style={{ ...styles.toolButton, ...(activeTool === "pen" ? styles.toolButtonActive : {}) }}
                        onClick={() => {
                            setActiveTool("pen");
                            setActivePanel("pen");
                        }}
                    >
                        Pen
                    </button>
                    <button
                        type="button"
                        style={{ ...styles.toolButton, ...(activeTool === "erase" ? styles.toolButtonActive : {}) }}
                        onClick={() => {
                            setActiveTool("erase");
                            setActivePanel("erase");
                        }}
                    >
                        Erase
                    </button>
                    <button
                        type="button"
                        style={{ ...styles.toolButton, ...(activePanel === "background" ? styles.toolButtonActive : {}) }}
                        onClick={() => setActivePanel("background")}
                    >
                        Background
                    </button>
                    <button type="button" style={styles.resetButton} onClick={clearBoard}>Reset</button>
                </div>

                {activePanel === "pen" && (
                    <div style={styles.panel}>
                        <label style={styles.label}>
                            Size
                            <input
                                type="range"
                                min={1}
                                max={40}
                                value={penSize}
                                onChange={(event) => setPenSize(Number(event.target.value))}
                                style={styles.range}
                            />
                            <span style={styles.value}>{penSize}px</span>
                        </label>
                        <div style={styles.colorsRow}>
                            {PRESET_COLORS.map((color) => (
                                <button
                                    type="button"
                                    key={color}
                                    style={{
                                        ...styles.colorSwatch,
                                        backgroundColor: color,
                                        outline: penColor === color ? "2px solid #111827" : "1px solid #cbd5e1",
                                    }}
                                    aria-label={`Set pen color ${color}`}
                                    onClick={() => setPenColor(color)}
                                />
                            ))}
                            <input
                                type="color"
                                value={penColor}
                                onChange={(event) => setPenColor(event.target.value)}
                                style={styles.colorPicker}
                                aria-label="Custom pen color"
                            />
                        </div>
                    </div>
                )}

                {activePanel === "erase" && (
                    <div style={styles.panel}>
                        <label style={styles.label}>
                            Size
                            <input
                                type="range"
                                min={4}
                                max={80}
                                value={eraserSize}
                                onChange={(event) => setEraserSize(Number(event.target.value))}
                                style={styles.range}
                            />
                            <span style={styles.value}>{eraserSize}px</span>
                        </label>
                    </div>
                )}

                {activePanel === "background" && (
                    <div style={styles.panel}>
                        <label style={styles.label}>
                            Color
                            <input
                                type="color"
                                value={backgroundColor}
                                onChange={(event) => setBackgroundColor(event.target.value)}
                                style={styles.colorPicker}
                            />
                        </label>
                        <label style={styles.label}>
                            Pattern
                            <select
                                value={backgroundPattern}
                                onChange={(event) => setBackgroundPattern(event.target.value as Pattern)}
                                style={styles.select}
                            >
                                <option value="none">None</option>
                                <option value="dots">Dots</option>
                                <option value="lines">Lines</option>
                                <option value="grid">Grid</option>
                            </select>
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: "calc(100vh - 80px)",
        position: "relative",
    },
    board: {
        width: "100%",
        height: "calc(100vh - 80px)",
        overflow: "hidden",
        position: "relative",
    },
    canvas: {
        width: "100%",
        height: "100%",
        display: "block",
        touchAction: "none",
        cursor: "crosshair",
        position: "relative",
        zIndex: 1,
    },
    toolbar: {
        position: "fixed",
        bottom: "16px",
        left: "16px",
        maxWidth: "min(94vw, 420px)",
        background: "rgba(255,255,255,0.95)",
        border: "1px solid #d1d5db",
        borderRadius: "12px",
        padding: "12px",
        boxShadow: "0 8px 30px rgba(15, 23, 42, 0.15)",
        zIndex: 120,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    toolbarRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
    },
    toolButton: {
        border: "1px solid #cbd5e1",
        borderRadius: "8px",
        background: "#ffffff",
        padding: "8px 10px",
        fontSize: "14px",
        cursor: "pointer",
    },
    toolButtonActive: {
        borderColor: "#2563eb",
        background: "#eff6ff",
        color: "#1d4ed8",
    },
    resetButton: {
        border: "1px solid #fecaca",
        borderRadius: "8px",
        background: "#fef2f2",
        color: "#b91c1c",
        padding: "8px 10px",
        fontSize: "14px",
        cursor: "pointer",
    },
    panel: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "14px",
    },
    value: {
        minWidth: "50px",
        fontFamily: "monospace",
    },
    range: {
        width: "100%",
        maxWidth: "220px",
    },
    colorsRow: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
    },
    colorSwatch: {
        width: "24px",
        height: "24px",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
    },
    colorPicker: {
        width: "36px",
        height: "30px",
        border: "1px solid #cbd5e1",
        borderRadius: "6px",
        padding: "2px",
        background: "#fff",
        cursor: "pointer",
    },
    select: {
        border: "1px solid #cbd5e1",
        borderRadius: "6px",
        padding: "6px 8px",
        background: "#fff",
    },
};
