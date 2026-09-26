import decodeQR from 'qr/decode.js';

self.onmessage = (event: MessageEvent<{ pixels: ImageData; camera: boolean }>) => {
    try {
        const value = decodeQR(event.data.pixels, { timeLimit: event.data.camera ? 80 : 600 });
        self.postMessage({ value });
    } catch {
        self.postMessage({ value: null });
    }
};
