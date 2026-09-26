import ScanWorker from './scan.worker?worker';

export function createScanner() {
    const worker = new ScanWorker();
    let pending: ((reason: Error) => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
        scan(pixels: ImageData, camera = false): Promise<string | null> {
            return new Promise((resolve, reject) => {
                pending = reject;
                const finish = () => { clearTimeout(timer); pending = null; };
                worker.onmessage = (event: MessageEvent<{ value: string | null }>) => {
                    finish();
                    resolve(event.data.value);
                };
                worker.onerror = () => { finish(); reject(new Error('The scanner could not load. Reload the page and try again.')); };
                timer = setTimeout(() => { finish(); reject(new Error('Scanning timed out. Try a smaller image or a clearer QR code.')); }, 10000);
                worker.postMessage({ pixels, camera }, [pixels.data.buffer]);
            });
        },
        dispose() {
            clearTimeout(timer);
            worker.terminate();
            pending?.(new Error('Scan cancelled.'));
            pending = null;
        },
    };
}

export function captureFrame(source: CanvasImageSource, width: number, height: number, maxSize: number) {
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Image scanning is unavailable in this browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return { canvas, pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
}

export function capturePixels(source: CanvasImageSource, width: number, height: number, maxSize: number): ImageData {
    return captureFrame(source, width, height, maxSize).pixels;
}
