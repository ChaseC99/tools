import { useEffect, useMemo, useState } from "react";

type PresetShape = "circle" | "rect";

interface CalibrationPreset {
    id: string;
    label: string;
    shape: PresetShape;
    widthMm: number;
    heightMm: number;
    dimensionLabel: string;
}

const STORAGE_KEY = "tool:ruler:calibrationScale";
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.25;
const STEP = 0.001;
const INCH_SPAN = 12;
const CM_SPAN = 30;

const PRESETS: CalibrationPreset[] = [
    { id: "quarter", label: "US Quarter", shape: "circle", widthMm: 24.26, heightMm: 24.26, dimensionLabel: "Diameter 24.26 mm" },
    { id: "card", label: "Credit Card", shape: "rect", widthMm: 85.6, heightMm: 53.98, dimensionLabel: "Width 85.60 mm" },
    { id: "usb-c", label: "USB-C Connector", shape: "rect", widthMm: 8.4, heightMm: 2.6, dimensionLabel: "Width 8.40 mm" },
];

const clampScale = (value: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));

export default function Ruler() {
    const [calibrationScale, setCalibrationScale] = useState(1);
    const [presetId, setPresetId] = useState(PRESETS[0].id);

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (!saved) return;
            const parsed = Number(saved);
            if (Number.isFinite(parsed)) setCalibrationScale(clampScale(parsed));
        } catch {
            // Ignore storage access failures.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, calibrationScale.toString());
        } catch {
            // Ignore storage access failures.
        }
    }, [calibrationScale]);

    const activePreset = useMemo(
        () => PRESETS.find((preset) => preset.id === presetId) ?? PRESETS[0],
        [presetId]
    );

    const inchTicks = useMemo(() => {
        const tickCount = INCH_SPAN * 16;
        return Array.from({ length: tickCount + 1 }, (_, index) => {
            const major = index % 16 === 0;
            const half = index % 8 === 0;
            const quarter = index % 4 === 0;
            const eighth = index % 2 === 0;
            const height = major ? 42 : half ? 32 : quarter ? 24 : eighth ? 18 : 12;
            return {
                key: `in-${index}`,
                left: `calc(var(--calibration-scale) * ${index / 16}in)`,
                height,
            };
        });
    }, []);

    const cmTicks = useMemo(() => {
        const tickCount = CM_SPAN * 10;
        return Array.from({ length: tickCount + 1 }, (_, index) => {
            const major = index % 10 === 0;
            const half = index % 5 === 0;
            const height = major ? 42 : half ? 28 : 14;
            return {
                key: `cm-${index}`,
                left: `calc(var(--calibration-scale) * ${index / 10}cm)`,
                height,
            };
        });
    }, []);

    const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) setCalibrationScale(clampScale(next));
    };

    const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) setCalibrationScale(clampScale(next));
    };

    const calibrationStyle = {
        ...styles.tool,
        "--calibration-scale": calibrationScale.toString(),
    } as React.CSSProperties;

    return (
        <div style={calibrationStyle}>
            <section style={styles.panel}>
                <h2 style={styles.sectionTitle}>Calibration</h2>
                <p style={styles.helpText}>
                    Match the reference shape to your physical item, then use the rulers below.
                </p>

                <label htmlFor="preset" style={styles.label}>Reference item</label>
                <select
                    id="preset"
                    value={presetId}
                    onChange={(event) => setPresetId(event.target.value)}
                    style={styles.select}
                >
                    {PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                </select>

                <p style={styles.presetMeta}>{activePreset.dimensionLabel}</p>

                <div style={styles.previewWrap}>
                    <div
                        aria-label={`Calibration preview for ${activePreset.label}`}
                        style={{
                            ...styles.preview,
                            width: `calc(var(--calibration-scale) * ${activePreset.widthMm / 10}cm)`,
                            height: `calc(var(--calibration-scale) * ${activePreset.heightMm / 10}cm)`,
                            borderRadius: activePreset.shape === "circle" ? "999px" : "4px",
                        }}
                    />
                </div>

                <label htmlFor="scale-slider" style={styles.label}>Calibration scale</label>
                <input
                    id="scale-slider"
                    type="range"
                    min={MIN_SCALE}
                    max={MAX_SCALE}
                    step={STEP}
                    value={calibrationScale}
                    onChange={handleSliderChange}
                    style={styles.slider}
                />

                <div style={styles.controlRow}>
                    <label htmlFor="scale-number" style={styles.labelInline}>Scale</label>
                    <input
                        id="scale-number"
                        type="number"
                        min={MIN_SCALE}
                        max={MAX_SCALE}
                        step={STEP}
                        value={calibrationScale.toFixed(3)}
                        onChange={handleNumberChange}
                        style={styles.numberInput}
                    />
                    <button
                        type="button"
                        onClick={() => setCalibrationScale(1)}
                        style={styles.button}
                    >
                        Reset
                    </button>
                    <span style={styles.scaleReadout}>Current: {(calibrationScale * 100).toFixed(1)}%</span>
                </div>
            </section>

            <section style={styles.panel}>
                <h2 style={styles.sectionTitle}>Inches ({INCH_SPAN} in)</h2>
                <div style={styles.rulerScroll}>
                    <div style={{ ...styles.ruler, width: `calc(var(--calibration-scale) * ${INCH_SPAN}in)` }}>
                        {inchTicks.map((tick) => (
                            <span key={tick.key} style={{ ...styles.tick, left: tick.left, height: `${tick.height}px` }} />
                        ))}
                        {Array.from({ length: INCH_SPAN + 1 }, (_, i) => (
                            <span
                                key={`in-label-${i}`}
                                style={{ ...styles.labelText, left: `calc(var(--calibration-scale) * ${i}in)` }}
                            >
                                {i}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            <section style={styles.panel}>
                <h2 style={styles.sectionTitle}>Centimeters ({CM_SPAN} cm)</h2>
                <div style={styles.rulerScroll}>
                    <div style={{ ...styles.ruler, width: `calc(var(--calibration-scale) * ${CM_SPAN}cm)` }}>
                        {cmTicks.map((tick) => (
                            <span key={tick.key} style={{ ...styles.tick, left: tick.left, height: `${tick.height}px` }} />
                        ))}
                        {Array.from({ length: CM_SPAN + 1 }, (_, i) => (
                            <span
                                key={`cm-label-${i}`}
                                style={{ ...styles.labelText, left: `calc(var(--calibration-scale) * ${i}cm)` }}
                            >
                                {i}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            <section style={styles.panel}>
                <h2 style={styles.sectionTitle}>Quick Tips</h2>
                <p style={styles.helpText}>1. Keep browser zoom at 100% for best results.</p>
                <p style={styles.helpText}>2. Calibrate once per device and display configuration.</p>
                <p style={styles.helpText}>3. Use the same display you calibrated on.</p>
            </section>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    tool: {
        minHeight: "calc(100vh - 80px)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxSizing: "border-box",
    },
    panel: {
        border: "1px solid #d9d9d9",
        borderRadius: "8px",
        padding: "16px",
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    sectionTitle: {
        margin: 0,
        fontSize: "1.1rem",
    },
    helpText: {
        margin: 0,
        color: "#4b5563",
        fontSize: "0.95rem",
    },
    label: {
        fontWeight: 600,
        marginTop: "8px",
    },
    select: {
        width: "100%",
        maxWidth: "300px",
        padding: "8px",
        border: "1px solid #cfcfcf",
        borderRadius: "6px",
        fontSize: "0.95rem",
    },
    presetMeta: {
        margin: "4px 0 0 0",
        color: "#4b5563",
        fontSize: "0.9rem",
    },
    previewWrap: {
        marginTop: "8px",
        minHeight: "80px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        backgroundColor: "#f8fafc",
        border: "1px dashed #cbd5e1",
        borderRadius: "8px",
        overflowX: "auto",
    },
    preview: {
        border: "2px solid #0f172a",
        backgroundColor: "#e2e8f0",
        boxSizing: "border-box",
        flexShrink: 0,
    },
    slider: {
        width: "100%",
        maxWidth: "380px",
    },
    controlRow: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px",
        marginTop: "8px",
    },
    labelInline: {
        fontWeight: 600,
    },
    numberInput: {
        width: "92px",
        padding: "6px 8px",
        border: "1px solid #cfcfcf",
        borderRadius: "6px",
    },
    button: {
        padding: "6px 12px",
        border: "1px solid #b7b7b7",
        borderRadius: "6px",
        backgroundColor: "#fff",
        cursor: "pointer",
    },
    scaleReadout: {
        fontWeight: 600,
        color: "#374151",
    },
    rulerScroll: {
        overflowX: "auto",
        overflowY: "hidden",
        paddingBottom: "8px",
    },
    ruler: {
        position: "relative",
        height: "72px",
        border: "1px solid #111827",
        borderRadius: "6px",
        backgroundColor: "#f8fafc",
        boxSizing: "border-box",
    },
    tick: {
        position: "absolute",
        bottom: "20px",
        width: "1px",
        backgroundColor: "#111827",
    },
    labelText: {
        position: "absolute",
        bottom: "2px",
        fontSize: "11px",
        transform: "translateX(-50%)",
        fontVariantNumeric: "tabular-nums",
        color: "#111827",
        userSelect: "none",
    },
};
