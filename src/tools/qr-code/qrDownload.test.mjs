import test from "node:test";
import assert from "node:assert/strict";
import { saveQRFile, supportsMobileShare } from "./qrDownload.mjs";

const file = new File(["image"], "qrcode.png", { type: "image/png" });
const phone = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", share: async () => {}, canShare: () => true };

test("detects phone and tablet sharing without treating desktop touchscreens as mobile", () => {
    for (const device of [phone, { ...phone, userAgent: "Android" },
        { ...phone, userAgent: "iPad" },
        { ...phone, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", maxTouchPoints: 5 },
        { ...phone, userAgent: "", userAgentData: { mobile: true } }]) {
        assert.equal(supportsMobileShare(device), true);
    }
    assert.equal(supportsMobileShare({ ...phone, userAgent: "Windows NT", maxTouchPoints: 10 }), false);
    assert.equal(supportsMobileShare({ ...phone, userAgent: "Macintosh", maxTouchPoints: 0 }), false);
    assert.equal(supportsMobileShare({ ...phone, share: undefined }), false);
    assert.equal(supportsMobileShare({ ...phone, canShare: undefined }), false);
});

test("opens sharing synchronously with only the prepared file to preserve user activation", async () => {
    let shared = false;
    const job = saveQRFile(file, { ...phone, share: (data) => {
        shared = true;
        assert.deepEqual(data, { files: [file] });
        return Promise.resolve();
    } }, () => assert.fail("should share instead of downloading"));
    assert.equal(shared, true);
    await job;
});

test("downloads on desktop or when the mobile browser cannot share the file", async () => {
    for (const device of [{ ...phone, userAgent: "Windows NT" },
        { ...phone, canShare: () => false }, { ...phone, share: undefined },
        { ...phone, canShare: () => { throw new Error("blocked"); } },
        { ...phone, share: async () => { throw new DOMException("blocked", "NotAllowedError"); } }]) {
        const saved = [];
        await saveQRFile(file, device, (blob, name) => saved.push({ blob, name }));
        assert.deepEqual(saved, [{ blob: file, name: "qrcode.png" }]);
    }
});

test("canceling the share sheet does not download or report an error", async () => {
    await saveQRFile(file, { ...phone, share: async () => { throw new DOMException("cancelled", "AbortError"); } },
        () => assert.fail("canceled sharing must not download"));
});

test("passes through the selected SVG or JPEG rather than silently changing format", async () => {
    for (const [extension, type] of [["svg", "image/svg+xml"], ["jpeg", "image/jpeg"]]) {
        const selected = new File(["image"], `qrcode.${extension}`, { type });
        await saveQRFile(selected, { ...phone, share: async ({ files }) => {
            assert.equal(files[0], selected);
            assert.equal(files[0].type, type);
        } }, () => assert.fail("should share selected format"));
    }
});
