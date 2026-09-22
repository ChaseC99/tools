import test from "node:test";
import assert from "node:assert/strict";
import { createQRImageSource, createQRRenderer, DEFAULT_BORDER_SPACING, getColorWarning, getQRLayout, isHexColor, normalizeWebsiteUrl } from "./qrLogic.mjs";

test("website input defaults to HTTPS and preserves paths, queries, and fragments", () => {
    for (const input of ["example.com", "www.example.com", "example.com/page?q=hello%20world#section", "example.com:8080/page", "localhost:3000", "127.0.0.1:4321/path"]) {
        assert.equal(normalizeWebsiteUrl(`  ${input}  `), `https://${input}`);
    }
    assert.equal(normalizeWebsiteUrl(" //example.com/page "), "https://example.com/page");
});

test("website input preserves explicit protocols without duplicating them", () => {
    for (const input of ["http://example.com", "https://example.com/page", "HTTPS://Example.com/Path", "http://localhost:3000/page", "ftp://example.com/file", "mailto:hello@example.com"]) {
        assert.equal(normalizeWebsiteUrl(` ${input} `), input);
        assert.equal(normalizeWebsiteUrl(normalizeWebsiteUrl(input)), input);
    }
});

test("blank website input stays empty rather than generating a protocol-only QR", () => {
    for (const input of ["", " ", "\n\t "]) assert.equal(normalizeWebsiteUrl(input), "");
});

test("centers whole modules with the requested default spacing at every output size", () => {
    for (const size of [128, 200, 256, 512, 1000, 1024, 2000]) {
        for (const level of ["L", "M", "Q", "H"]) {
            for (const data of ["1", "HELLO WORLD", "https://example.com", "x".repeat(150)]) {
                const layout = getQRLayout(data, size, level);
                const actualModuleSize = Math.floor((size - layout.margin * 2) / layout.moduleCount);
                assert.ok(actualModuleSize >= 1);
                assert.equal(actualModuleSize, layout.moduleSize);
                const start = Math.floor((size - layout.moduleCount * actualModuleSize) / 2);
                const end = size - start - layout.moduleCount * actualModuleSize;
                assert.ok(start >= Math.ceil(size * DEFAULT_BORDER_SPACING / 100));
                assert.ok(end >= Math.ceil(size * DEFAULT_BORDER_SPACING / 100));
                assert.ok(Math.abs(start - end) <= 1);
            }
        }
    }
});

test("reports capacity errors and permits a subsequent valid request", () => {
    assert.throws(() => getQRLayout("x".repeat(4000), 1024, "M"), /content is too long/);
    assert.ok(getQRLayout("https://example.com", 256, "M").moduleSize > 0);
});

test("the radius limit fits the existing margin without changing the QR size", () => {
    for (const size of [128, 200, 256, 512, 1000, 1024, 2000]) {
        for (const spacing of [0, 1, 4, 10, 20]) {
            const layout = getQRLayout("https://example.com", size, "M", spacing);
            for (let rounding = 0; rounding <= layout.maxRadiusPercent; rounding++) {
                const { margin, moduleSize, moduleCount } = layout;
                const radius = size * rounding / 100;
                assert.ok(margin >= Math.ceil(size * spacing / 100));
                if (margin < radius) {
                    assert.ok(Math.hypot(radius - margin, radius - margin) <= radius + 1e-10);
                }
                assert.equal(moduleSize, Math.floor((size - 2 * Math.ceil(size * spacing / 100)) / moduleCount));
            }
            if (layout.maxRadiusPercent < 25) {
                const nextRadius = size * (layout.maxRadiusPercent + 1) / 100;
                assert.ok(Math.hypot(nextRadius - layout.margin, nextRadius - layout.margin) > nextRadius);
            }
        }
    }
});

test("thin borders allow less rounding and no border can require square corners", () => {
    assert.ok(getQRLayout("https://example.com", 256, "M", 0).maxRadiusPercent < 5);
    assert.equal(getQRLayout("https://example.com", 250, "M", 0).maxRadiusPercent, 0);
    assert.equal(getQRLayout("https://example.com", 256, "M", 20).maxRadiusPercent, 25);
});

test("the default border is slimmer and can shrink further to zero requested spacing", () => {
    for (const size of [128, 200, 256, 512, 1000, 1024, 2000]) {
        const normal = getQRLayout("https://example.com", size, "M");
        const smallest = getQRLayout("https://example.com", size, "M", 0);
        const previousModuleSize = Math.floor(size / (normal.moduleCount + 8));
        const previousMargin = Math.floor((size - normal.moduleCount * previousModuleSize) / 2);
        assert.ok(normal.margin < previousMargin);
        assert.ok(smallest.margin < normal.margin);
        assert.ok(smallest.margin >= 0);
        assert.ok(smallest.margin < smallest.moduleCount / 2);
    }
});

test("extra spacing increases the border while keeping the requested output dimensions", () => {
    const normal = getQRLayout("https://example.com", 512, "M");
    const spacious = getQRLayout("https://example.com", 512, "M", 20);
    assert.ok(spacious.margin > normal.margin);
    assert.ok(spacious.moduleSize < normal.moduleSize);
    assert.ok(2 * spacious.margin + spacious.moduleCount * spacious.moduleSize <= 512);
});

test("rejects an output too small for its data rather than producing zero-size dots", () => {
    assert.throws(() => getQRLayout("x".repeat(1000), 128, "H"), /too dense/);
    assert.ok(getQRLayout("x".repeat(1000), 512, "H").moduleSize > 0);
});

test("only accepts complete six-digit hex colors", () => {
    for (const value of ["", "#", "#123", "#12345", "#1234567", "#gggggg", "red"]) assert.equal(isHexColor(value), false);
    for (const value of ["#000000", "#ffffff", "#A1b2C3"]) assert.equal(isHexColor(value), true);
});

test("distinguishes identical, low contrast, and inverted colors", () => {
    assert.match(getColorWarning("#ABCDEF", "#abcdef").reason, /identical/);
    assert.match(getColorWarning("#eeeeee", "#ffffff").reason, /low contrast/);
    assert.match(getColorWarning("#ffffff", "#000000").reason, /Light dots/);
    assert.equal(getColorWarning("#000000", "#ffffff"), null);
});

test("keeps one renderer and serializes logo updates until each SVG is complete", async () => {
    const updates = [];
    let instances = 0;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    class Renderer {
        constructor() { instances++; }
        update(options) { this.options = options; updates.push(options); }
        async getRawData() {
            if (this.options.image) await gate;
            return new Blob([this.options.data + this.options.image]);
        }
    }
    const render = createQRRenderer(Renderer);
    const first = render({ data: "first", image: "logo" });
    const second = render({ data: "second", image: "" });
    await Promise.resolve();
    assert.equal(updates.length, 1);
    release();
    assert.equal(await (await first).text(), "firstlogo");
    assert.equal(await (await second).text(), "second");
    assert.equal(instances, 1);
});

test("discards obsolete renders and recovers after a renderer failure", async () => {
    const updates = [];
    class Renderer {
        update(options) { updates.push(options.data); if (options.data === "bad") throw new Error("bad"); }
        async getRawData() { return new Blob(["valid"]); }
    }
    const render = createQRRenderer(Renderer);
    assert.equal(await render({ data: "obsolete" }, () => false), null);
    await assert.rejects(render({ data: "bad" }), /bad/);
    assert.equal(await (await render({ data: "good" })).text(), "valid");
    assert.deepEqual(updates, ["bad", "good"]);
});

test("discards an in-flight result after its settings change", async () => {
    let current = true;
    class Renderer {
        update() {}
        async getRawData() { current = false; return new Blob(["outdated"]); }
    }
    assert.equal(await createQRRenderer(Renderer)({}, () => current), null);
});

test("an action shares the pending preview render instead of exporting the previous image", async () => {
    const rendered = [];
    const source = createQRImageSource(async (options) => {
        rendered.push(options.data);
        return new Blob([options.data]);
    });
    const old = { data: "old" };
    await source(old, () => old);
    const updated = { data: "updated" };
    const preview = source(updated, () => updated);
    const download = source(updated, () => updated, true);
    assert.equal(download, preview);
    assert.equal(await (await download).text(), "updated");
    assert.deepEqual(rendered, ["old", "updated"]);
});

test("a clicked export completes with its selected settings even when another edit follows", async () => {
    class Renderer {
        update(options) { this.data = options.data; }
        async getRawData() { return new Blob([this.data]); }
    }
    const source = createQRImageSource(createQRRenderer(Renderer));
    const clicked = { data: "settings at click" };
    const preview = source(clicked, () => clicked);
    const download = source(clicked, () => clicked, true);
    const later = { data: "later edit" };
    const next = source(later, () => later);
    assert.equal(download, preview);
    assert.equal(await (await download).text(), "settings at click");
    assert.equal(await (await next).text(), "later edit");
});

test("an obsolete preview is skipped while a new request still completes", async () => {
    class Renderer {
        update(options) { this.data = options.data; }
        async getRawData() { return new Blob([this.data]); }
    }
    const source = createQRImageSource(createQRRenderer(Renderer));
    const old = { data: "obsolete" };
    const skipped = assert.rejects(source(old, () => old), /settings changed/);
    const latest = { data: "latest" };
    assert.equal(await (await source(latest, () => latest)).text(), "latest");
    await skipped;
});
