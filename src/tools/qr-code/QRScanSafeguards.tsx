import { useEffect, useState } from "react";
import { getColorWarning } from "./qrLogic.mjs";
import { scanQRImage, type QRWarning } from "./qrScan";

const CHECK_DELAY_MS = 500;

type Props = {
    foreground: string;
    background: string;
    enabled: boolean;
    image: Blob | null;
    size: number;
    content: string;
};

export default function QRScanSafeguards({ foreground, background, enabled, image, size, content }: Props) {
    const key = `${foreground}:${background}`;
    const [result, setResult] = useState<{ key: string; warning: QRWarning | null } | null>(null);
    const [scanResult, setScanResult] = useState<{ image: Blob; size: number; content: string; warning: QRWarning | null } | null>(null);

    useEffect(() => {
        if (!enabled) return;
        const timer = setTimeout(() => {
            setResult({ key, warning: getColorWarning(foreground, background) });
        }, CHECK_DELAY_MS);
        return () => clearTimeout(timer);
    }, [foreground, background, enabled, key]);

    useEffect(() => {
        if (!enabled || !image) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            let warning: QRWarning | null;
            try {
                warning = await scanQRImage(image, size, content, controller.signal);
            } catch {
                warning = null;
            }
            if (!controller.signal.aborted) setScanResult({ image, size, content, warning });
        }, CHECK_DELAY_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [enabled, image, size, content]);

    const colorWarning = result?.key === key ? result.warning : null;
    const scanWarning = scanResult?.image === image && scanResult?.size === size && scanResult?.content === content
        ? scanResult.warning : null;
    if (!enabled || (!colorWarning && !scanWarning)) return null;
    const reason = colorWarning && scanWarning
        ? `${colorWarning.reason.slice(0, -1)}, and ${scanWarning.reason.charAt(0).toLowerCase()}${scanWarning.reason.slice(1)}`
        : (colorWarning || scanWarning)!.reason;
    const tip = (colorWarning || scanWarning)!.tip;
    return (
        <div className="qr-safeguards ui-alert" data-variant="warning" role="status" aria-live="polite" aria-atomic="true">
            <p className="qr-warning-reason"><span aria-hidden="true">⚠️</span> {reason}</p>
            <p>{tip}</p>
        </div>
    );
}
