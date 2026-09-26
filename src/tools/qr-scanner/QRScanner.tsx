import { useEffect, useRef, useState } from 'react';
import ImageInput from '@tools/shared/ImageInput';
import { loadImage, downloadQRImage } from '@tools/qr-code/qrImage';
import { describeQR, type QRAction } from './qrContent.mjs';
import { captureFrame, capturePixels, createScanner } from './scanner';
import './QRScanner.css';

type ScanState = 'idle' | 'starting' | 'camera' | 'image';
type SelectedImage = { name: string; url: string };

function cameraError(error: unknown): string {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was denied. Allow camera access in your browser settings, or choose an image.';
    if (name === 'NotFoundError') return 'No camera was found. Choose an image instead.';
    if (name === 'NotReadableError') return 'The camera is busy or unavailable. Close other apps using it and try again.';
    return error instanceof Error ? error.message : 'Could not start the camera. Try choosing an image instead.';
}

export default function QRScanner() {
    const [mode, setMode] = useState<'image' | 'camera'>('image');
    const [state, setState] = useState<ScanState>('idle');
    const [dragging, setDragging] = useState(false);
    const [selected, setSelected] = useState<SelectedImage | null>(null);
    const [snapshot, setSnapshot] = useState<string | null>(null);
    const [raw, setRaw] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const video = useRef<HTMLVideoElement>(null);
    const stream = useRef<MediaStream | null>(null);
    const decoder = useRef<ReturnType<typeof createScanner> | null>(null);
    const generation = useRef(0);
    const frameTimer = useRef<ReturnType<typeof setTimeout>>();
    const imageUrl = useRef<string | null>(null);
    const content = raw === null ? null : describeQR(raw);

    // Every source change invalidates pending image loads, permission prompts and decodes.
    function release() {
        generation.current++;
        clearTimeout(frameTimer.current);
        decoder.current?.dispose();
        decoder.current = null;
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (video.current) video.current.srcObject = null;
    }

    function stop() {
        release();
        setState('idle');
    }

    function removeImage() {
        if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
        imageUrl.current = null;
        setSelected(null);
    }

    function reset() {
        stop();
        removeImage();
        setSnapshot(null);
        setRaw(null);
        setError('');
        setNotice('');
    }

    useEffect(() => {
        const hide = () => {
            if (stream.current || video.current) stop();
        };
        const visibility = () => { if (document.hidden) hide(); };
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('pagehide', hide);
        return () => {
            release();
            if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
            document.removeEventListener('visibilitychange', visibility);
            window.removeEventListener('pagehide', hide);
        };
    }, []);

    function showResult(value: string) {
        stop();
        setRaw(value);
    }

    async function scanImage(file: File) {
        reset();
        const current = generation.current;
        if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name)) {
            setError('Choose an image file, such as PNG, JPEG, or WebP.');
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            setError('This image is too large. Choose an image smaller than 25 MB.');
            return;
        }
        const url = URL.createObjectURL(file);
        imageUrl.current = url;
        setSelected({ name: file.name, url });
        setState('image');
        try {
            const image = await loadImage(url);
            if (current !== generation.current) return;
            const scanner = createScanner();
            decoder.current = scanner;
            const value = await scanner.scan(capturePixels(image, image.naturalWidth, image.naturalHeight, 2560));
            if (current !== generation.current) return;
            if (value === null) {
                stop();
                setError('No QR code was found. Try a sharper image or crop closer to a single QR code, keeping its full border visible.');
            } else showResult(value);
        } catch (error) {
            if (current !== generation.current) return;
            stop();
            setError(error instanceof Error ? error.message : 'Could not read this image. Try PNG or JPEG.');
        }
    }

    async function startCamera() {
        reset();
        const current = generation.current;
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setError('Camera scanning requires HTTPS (or localhost) and a browser with camera support. Choose an image instead.');
            return;
        }
        setState('starting');
        try {
            const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
            if (current !== generation.current) {
                media.getTracks().forEach((track) => track.stop());
                return;
            }
            stream.current = media;
            for (const track of media.getVideoTracks()) {
                track.addEventListener('ended', () => {
                    if (current !== generation.current) return;
                    stop();
                    setError('The camera disconnected. Start it again or choose an image.');
                }, { once: true });
            }
            const element = video.current;
            if (!element) { stop(); return; }
            element.srcObject = media;
            await element.play();
            if (current !== generation.current) return;
            const scanner = createScanner();
            decoder.current = scanner;
            setState('camera');
            const frame = async () => {
                if (current !== generation.current) return;
                try {
                    if (element.readyState >= 2 && element.videoWidth) {
                        // Retain the exact frame being decoded while its pixel buffer is transferred to the worker.
                        const captured = captureFrame(element, element.videoWidth, element.videoHeight, 1440);
                        const value = await scanner.scan(captured.pixels, true);
                        if (current !== generation.current) return;
                        if (value !== null) {
                            setSnapshot(captured.canvas.toDataURL('image/png'));
                            showResult(value);
                            return;
                        }
                    }
                    frameTimer.current = setTimeout(frame, 200);
                } catch (error) {
                    if (current !== generation.current) return;
                    stop();
                    setError(cameraError(error));
                }
            };
            void frame();
        } catch (error) {
            if (current !== generation.current) return;
            stop();
            setError(cameraError(error));
        }
    }

    async function copy(value: string, message: string) {
        const current = generation.current;
        try {
            await navigator.clipboard.writeText(value);
            if (current === generation.current) setNotice(message);
        } catch {
            if (current === generation.current) setNotice('Clipboard access is unavailable. Select and copy the raw data manually.');
        }
    }

    function runAction(action: QRAction) {
        if (action.kind === 'copy') void copy(action.content, 'Copied to clipboard.');
        if (action.kind === 'download') {
            downloadQRImage(new Blob([action.content], { type: action.mime }), action.filename);
            setNotice(`Downloaded ${action.filename}. Open the file to review and add it.`);
        }
    }

    return (
        <div className="qr-scanner ui-stack ph-no-capture" data-gap="lg">
            <header className="ui-stack" data-gap="sm">
                <h1>QR code scanner</h1>
                <p>Inspect the raw data of a QR code. Decoded in the browser - the image you share will not leave your device.</p>
            </header>
            <div className="qr-scanner__workspace" data-has-result={raw !== null}>
                <section className="ui-panel ui-stack" aria-label="Scan a QR code">
                    <div className="ui-segmented" aria-label="Input source">
                        <button type="button" className="ui-button" aria-pressed={mode === 'image'} onClick={() => { if (mode !== 'image') { reset(); setMode('image'); } }}>Image</button>
                        <button type="button" className="ui-button" aria-pressed={mode === 'camera'} onClick={() => { if (mode !== 'camera') { reset(); setMode('camera'); } }}>Camera</button>
                    </div>
                    {mode === 'image' ? <>
                        <ImageInput onFile={scanImage} dragging={dragging} onDraggingChange={setDragging}
                            title="Drop a QR code image here" formats={['PNG', 'JPEG', 'WebP', 'SVG']} maxFileSize="25 MB"
                            fileName={selected?.name} previewUrl={selected?.url} onRemove={reset}
                            loading={state === 'image'} loadingLabel="Scanning image…" />
                        {selected && <img className="qr-scanner__image ph-no-capture" src={selected.url} alt="Image selected for QR scanning" />}
                    </> : <>
                        <div className="qr-scanner__camera">
                            <video ref={video} muted playsInline aria-label="Live camera preview" aria-hidden={snapshot !== null} />
                            {snapshot && <img className="ph-no-capture" src={snapshot} alt="Captured camera frame containing the scanned QR code" />}
                            {!snapshot && state !== 'camera' && <p>{state === 'starting' ? 'Waiting for camera access…' : 'Your camera is off'}</p>}
                        </div>
                        <div className="ui-inline">
                            {state === 'camera' || state === 'starting'
                                ? <button type="button" className="ui-button" data-variant="secondary" onClick={stop}>Stop camera</button>
                                : <button type="button" className="ui-button" onClick={startCamera}>{raw === null ? 'Start camera' : 'Scan another QR code'}</button>}
                        </div>
                        <p className="ui-hint">Point your camera at one QR code and keep its full border visible.<br />The camera stops when a code is found.</p>
                    </>}
                    <p className="ui-hint" role="status">{state === 'camera' ? 'Looking for a QR code…' : state === 'image' ? 'Reading your image…' : state === 'starting' ? 'Allow camera access to begin scanning.' : ''}</p>
                    {error && <p className="ui-alert" data-variant="danger" role="alert">{error}</p>}
                </section>
                {content && raw !== null && <section className="ui-panel ui-stack qr-scanner__result ph-no-capture" aria-label="Scan result">
                    <div className="ui-inline qr-scanner__result-heading"><h2>Scan result</h2><span className="ui-badge">{content.type}</span></div>
                    <label className="ui-field" htmlFor="qr-raw-data">
                        <span className="ui-label">Raw data</span>
                        <textarea id="qr-raw-data" className="ui-textarea ui-mono ph-no-capture" readOnly value={raw} rows={10} spellCheck={false} />
                    </label>
                    <div className="ui-inline">
                        <button type="button" className="ui-button" data-variant="secondary" onClick={() => copy(raw, 'Raw data copied.')}>Copy raw data</button>
                        {content.action?.kind === 'link'
                            ? <a className="ui-button qr-scanner__action ph-no-capture" href={content.action.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{content.action.label}</a>
                            : content.action && <button type="button" className="ui-button qr-scanner__action" onClick={() => runAction(content.action!)}>{content.action.label}</button>}
                    </div>
                    <p className="ui-hint" role="status">{notice}</p>
                </section>}
            </div>
            <p className="ui-hint">Need to make a QR code? <a href="/qr-code">Open the QR code generator</a>.</p>
        </div>
    );
}
