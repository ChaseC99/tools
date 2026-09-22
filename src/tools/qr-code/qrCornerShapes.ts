export type CornerType = "square" | "rounded" | "circle" | "leaf" | "beveled" | "dots";
export type CornerPart = "outer" | "inner";

export const cornerOptions: { value: CornerType; label: string }[] = [
    { value: "square", label: "Square" },
    { value: "rounded", label: "Rounded" },
    { value: "circle", label: "Circle" },
    { value: "leaf", label: "Leaf" },
    { value: "beveled", label: "Beveled" },
    { value: "dots", label: "Dotted" },
];

function roundedSquare(inset: number, size: number, radius: number, leaf = false) {
    const a = inset;
    const b = inset + size;
    const r = radius;
    const other = leaf ? 0 : radius;
    return `M ${a + r} ${a} H ${b - other} Q ${b} ${a} ${b} ${a + other}
        V ${b - r} Q ${b} ${b} ${b - r} ${b} H ${a + other}
        Q ${a} ${b} ${a} ${b - other} V ${a + r} Q ${a} ${a} ${a + r} ${a} Z`;
}

function beveledSquare(inset: number, size: number, cut: number) {
    const a = inset;
    const b = inset + size;
    return `M ${a + cut} ${a} H ${b - cut} L ${b} ${a + cut} V ${b - cut}
        L ${b - cut} ${b} H ${a + cut} L ${a} ${b - cut} V ${a + cut} Z`;
}

function circle(cx: number, cy: number, radius: number) {
    return `M ${cx - radius} ${cy} a ${radius} ${radius} 0 1 0 ${2 * radius} 0 a ${radius} ${radius} 0 1 0 ${-2 * radius} 0 Z`;
}

/** Module-space paths shared by picker samples, preview, scan checks, and exports. */
export function cornerPath(part: CornerPart, type: CornerType): string {
    const size = part === "outer" ? 7 : 3;
    if (type === "dots") {
        const paths: string[] = [];
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            if (part === "inner" || x === 0 || y === 0 || x === size - 1 || y === size - 1) {
                paths.push(circle(x + 0.5, y + 0.5, 0.5));
            }
        }
        return paths.join(" ");
    }
    const outline = (inset: number) => {
        const width = size - 2 * inset;
        if (type === "circle") return circle(size / 2, size / 2, width / 2);
        if (type === "beveled") return beveledSquare(inset, width, size * 0.24 - inset * (2 - Math.SQRT2));
        const radius = type === "leaf" ? size * 0.48 : type === "rounded" ? size * 0.3 : 0;
        return roundedSquare(inset, width, Math.max(0, radius - inset), type === "leaf");
    };
    return outline(0) + (part === "outer" ? ` ${outline(1)}` : "");
}

/** Replace the renderer's isolated finder clips, preserving its exact placement and color. */
export async function styleQRCorners(blob: Blob, styles: { outer: CornerType; inner: CornerType }) {
    const document = new DOMParser().parseFromString(await blob.text(), "image/svg+xml");
    for (const part of ["outer", "inner"] as const) {
        // Explicit corner colors create separate clips in qr-code-styling 1.9.2.
        const prefix = `clip-path-corners-${part === "outer" ? "square" : "dot"}-color-`;
        const clips = document.querySelectorAll(`clipPath[id^="${prefix}"]`);
        if (clips.length !== 3) throw new Error("Could not style the QR corners. Please refresh and try again.");
        for (const clip of clips) {
            const rect = Array.from(document.querySelectorAll("rect[clip-path]"))
                .find((element) => element.getAttribute("clip-path") === `url('#${clip.id}')`);
            if (!rect) throw new Error("Could not locate the QR corners.");
            const x = Number(rect.getAttribute("x"));
            const y = Number(rect.getAttribute("y"));
            const width = Number(rect.getAttribute("width"));
            const units = part === "outer" ? 7 : 3;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", cornerPath(part, styles[part]));
            path.setAttribute("clip-rule", "evenodd");
            path.setAttribute("transform", `translate(${x} ${y}) scale(${width / units})`);
            clip.replaceChildren(path);
        }
    }
    return new Blob([new XMLSerializer().serializeToString(document)], { type: "image/svg+xml" });
}
