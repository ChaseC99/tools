import { useEffect, useState } from "react";
import { isHexColor } from "./qrLogic.mjs";
import { DEFAULT_LOGO_SETTINGS, type LogoSettings } from "./qrLogo";

type Props = { settings: LogoSettings; background: string; onChange: (settings: LogoSettings) => void };

export default function LogoControls({ settings, background, onChange }: Props) {
    const backingColor = settings.color ?? background;
    const [colorDraft, setColorDraft] = useState(backingColor);
    useEffect(() => setColorDraft(backingColor), [backingColor]);
    const update = (patch: Partial<LogoSettings>) => onChange({ ...settings, ...patch });
    return (
        <div className="qr-logo-controls ui-stack">
            <div className="qr-logo-presets" role="group" aria-label="Logo fit">
                {(["fill", "fit"] as const).map((fit) => (
                    <button key={fit} type="button" className="ui-button" data-size="sm" data-variant={settings.fit === fit ? "primary" : "secondary"} aria-pressed={settings.fit === fit}
                        onClick={() => update({ fit })}>{fit === "fill" ? "Fill" : "Fit"}</button>
                ))}
            </div>
            <div className="ui-stack" data-gap="sm">
                <label className="ui-field" htmlFor="qr-logo-size">
                    <span className="ui-label">Logo size</span>
                    <input id="qr-logo-size" className="ui-range" type="range" min={10} max={30} step={1} value={settings.size}
                        aria-valuetext={`${settings.size}% of QR pattern width, including backing and padding`}
                        onChange={(event) => update({ size: Number(event.target.value) })} />
                </label>
                <div className="qr-logo-presets" role="group" aria-label="Logo size presets">
                    {([{ label: "Small", size: 14 }, { label: "Medium", size: 20 }, { label: "Large", size: 26 }]).map(({ label, size }) => (
                        <button key={size} type="button" className="ui-button" data-size="sm" data-variant={settings.size === size ? "primary" : "secondary"} aria-pressed={settings.size === size}
                            onClick={() => update({ size })}>{label}</button>
                    ))}
                </div>
            </div>
            <div className="ui-grid qr-logo-grid">
                <label className="ui-field" htmlFor="qr-logo-shape">
                    <span className="ui-label">Backing shape</span>
                    <select id="qr-logo-shape" className="ui-select" value={settings.shape}
                        onChange={(event) => update({ shape: event.target.value as LogoSettings["shape"] })}>
                        <option value="none">No backing</option>
                        <option value="square">Square</option>
                        <option value="rounded">Rounded square</option>
                        <option value="circle">Circle</option>
                    </select>
                </label>
                <label className="ui-field" htmlFor="qr-logo-color">
                    <span className="ui-label">Backing color</span>
                    <div className="ui-color-field">
                        <input id="qr-logo-color" className="ui-color-input" type="color" value={backingColor} disabled={settings.shape === "none"}
                            onChange={(event) => { setColorDraft(event.target.value); update({ color: event.target.value }); }} />
                        <input aria-label="Backing color hex" className="ui-input qr-color-value" type="text" maxLength={7}
                            value={colorDraft} disabled={settings.shape === "none"} aria-invalid={!isHexColor(colorDraft)}
                            aria-describedby={!isHexColor(colorDraft) ? "qr-logo-color-hint" : undefined}
                            onChange={(event) => { setColorDraft(event.target.value); if (isHexColor(event.target.value)) update({ color: event.target.value }); }} />
                    </div>
                    {!isHexColor(colorDraft) && <span id="qr-logo-color-hint" className="ui-hint">Enter a six-digit hex color. Preview and downloads keep the last valid color.</span>}
                </label>
            </div>
            <label className="ui-field" htmlFor="qr-logo-padding">
                <span className="ui-label">Padding <span className="ui-muted">{settings.padding}%</span></span>
                <input id="qr-logo-padding" className="ui-range" type="range" min={0} max={20} step={1} value={settings.padding}
                    aria-valuetext={`${settings.padding}% of logo frame per side`}
                    onChange={(event) => update({ padding: Number(event.target.value) })} />
            </label>
            <button type="button" className="ui-button qr-logo-reset" data-variant="secondary" data-size="sm"
                onClick={() => { setColorDraft(background); onChange({ ...DEFAULT_LOGO_SETTINGS }); }}>Reset adjustments</button>
        </div>
    );
}
