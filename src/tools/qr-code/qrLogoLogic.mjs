/** Ignore fully transparent margins, retaining even faint antialiased pixels. */
export function getAlphaBounds(data, width, height) {
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] === 0) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
    }
    return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Map a source rectangle into a square crop frame without stretching it. */
export function getLogoPlacement(bounds, frame, fit) {
    const scale = (fit === "fill" ? Math.max : Math.min)(frame.size / bounds.width, frame.size / bounds.height);
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    return {
        x: frame.x + (frame.size - width) / 2 - bounds.x * scale,
        y: frame.y + (frame.size - height) / 2 - bounds.y * scale,
        scale,
    };
}
