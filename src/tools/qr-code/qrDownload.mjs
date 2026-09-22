/** Include tablets and iPads that report a desktop user agent. */
export function supportsMobileShare(device) {
    const mobile = device.userAgentData?.mobile === true
        || /Android|iPhone|iPad|iPod/i.test(device.userAgent || "")
        || (/Macintosh|MacIntel/i.test(device.userAgent || "") && device.maxTouchPoints > 1);
    return mobile && typeof device.share === "function" && typeof device.canShare === "function";
}

/** Call with an already prepared file during the user's click (before any await). */
export async function saveQRFile(file, device, download) {
    if (supportsMobileShare(device)) {
        try {
            if (device.canShare({ files: [file] })) {
                await device.share({ files: [file] });
                return;
            }
        } catch (error) {
            // Dismissing the share sheet must not trigger an unwanted download.
            if (error?.name === "AbortError") return;
            // Unsupported formats, policy restrictions, or share failures fall back.
        }
    }
    download(file, file.name);
}
