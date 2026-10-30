/**
 * Unsupported or blocked haptics must never interfere with scoring.
 * @param {{ vibrate?: (pattern: number | number[]) => boolean }} browser
 * @param {boolean} win
 */
export function hapticFeedback(browser, win = false) {
    try { browser.vibrate?.(win ? [20, 40, 20] : 10); }
    catch { /* The visual score feedback is always available. */ }
}

/**
 * Called directly from the share button to retain browser user activation.
 * Canceling the native sheet does not copy anything or report an error.
 * @param {{ share?: (data: {text: string}) => Promise<void>, clipboard?: {writeText: (text: string) => Promise<void>} }} browser
 * @param {string} text
 * @returns {Promise<"shared" | "cancelled" | "copied" | "manual">}
 */
export async function shareFinalScore(browser, text) {
    if (typeof browser.share === "function") {
        try {
            await browser.share({ text });
            return "shared";
        } catch (error) {
            if (error?.name === "AbortError") return "cancelled";
        }
    }
    try {
        if (!browser.clipboard) return "manual";
        await browser.clipboard.writeText(text);
        return "copied";
    } catch { return "manual"; }
}
