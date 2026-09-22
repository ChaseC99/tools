// Static samples generated from qr-code-styling 1.9.2 geometry.
// Use the same module pattern in every dot sample for a fair comparison.
import type { ReactNode } from "react";
import { cornerPath, type CornerType } from "./qrCornerShapes";

const dots: Record<string, ReactNode> = {
    "square": <>
        <rect x="4" y="4" width="8" height="8" />
        <rect x="12" y="4" width="8" height="8" />
        <rect x="36" y="4" width="8" height="8" />
        <rect x="4" y="12" width="8" height="8" />
        <rect x="28" y="12" width="8" height="8" />
        <rect x="4" y="20" width="8" height="8" />
        <rect x="12" y="20" width="8" height="8" />
        <rect x="20" y="20" width="8" height="8" />
        <rect x="20" y="28" width="8" height="8" />
        <rect x="36" y="28" width="8" height="8" />
        <rect x="4" y="36" width="8" height="8" />
        <rect x="20" y="36" width="8" height="8" />
        <rect x="28" y="36" width="8" height="8" />
        <rect x="36" y="36" width="8" height="8" />
    </>,
    "rounded": <>
        <path d="M 4 4v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(-90,8,8)" />
        <path d="M 12 4v 8h 4a 4 4, 0, 0, 0, 0 -8" />
        <circle cx="40" cy="8" r="4" />
        <rect x="4" y="12" width="8" height="8" />
        <circle cx="32" cy="16" r="4" />
        <path d="M 4 20v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(180,8,24)" />
        <rect x="12" y="20" width="8" height="8" />
        <path d="M 20 20v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" />
        <rect x="20" y="28" width="8" height="8" />
        <path d="M 36 28v 8h 4a 4 4, 0, 0, 0, 0 -8" transform="rotate(-90,40,32)" />
        <circle cx="8" cy="40" r="4" />
        <path d="M 20 36v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(180,24,40)" />
        <rect x="28" y="36" width="8" height="8" />
        <path d="M 36 36v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,40,40)" />
    </>,
    "dots": <>
        <circle cx="8" cy="8" r="4" />
        <circle cx="16" cy="8" r="4" />
        <circle cx="40" cy="8" r="4" />
        <circle cx="8" cy="16" r="4" />
        <circle cx="32" cy="16" r="4" />
        <circle cx="8" cy="24" r="4" />
        <circle cx="16" cy="24" r="4" />
        <circle cx="24" cy="24" r="4" />
        <circle cx="24" cy="32" r="4" />
        <circle cx="40" cy="32" r="4" />
        <circle cx="8" cy="40" r="4" />
        <circle cx="24" cy="40" r="4" />
        <circle cx="32" cy="40" r="4" />
        <circle cx="40" cy="40" r="4" />
    </>,
    "classy": <>
        <path d="M 4 4v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(-90,8,8)" />
        <path d="M 12 4v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,16,8)" />
        <path d="M 36 4v 4a 4 4, 0, 0, 0, 4 4h 4v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,40,8)" />
        <rect x="4" y="12" width="8" height="8" />
        <path d="M 28 12v 4a 4 4, 0, 0, 0, 4 4h 4v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,32,16)" />
        <rect x="4" y="20" width="8" height="8" />
        <rect x="12" y="20" width="8" height="8" />
        <rect x="20" y="20" width="8" height="8" />
        <rect x="20" y="28" width="8" height="8" />
        <path d="M 36 28v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(-90,40,32)" />
        <path d="M 4 36v 4a 4 4, 0, 0, 0, 4 4h 4v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,8,40)" />
        <rect x="20" y="36" width="8" height="8" />
        <rect x="28" y="36" width="8" height="8" />
        <path d="M 36 36v 8h 8v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,40,40)" />
    </>,
    "classy-rounded": <>
        <path d="M 4 4v 8h 8a 8 8, 0, 0, 0, -8 -8" transform="rotate(-90,8,8)" />
        <path d="M 12 4v 8h 8a 8 8, 0, 0, 0, -8 -8" transform="rotate(90,16,8)" />
        <path d="M 36 4v 4a 4 4, 0, 0, 0, 4 4h 4v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,40,8)" />
        <rect x="4" y="12" width="8" height="8" />
        <path d="M 28 12v 4a 4 4, 0, 0, 0, 4 4h 4v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,32,16)" />
        <rect x="4" y="20" width="8" height="8" />
        <rect x="12" y="20" width="8" height="8" />
        <rect x="20" y="20" width="8" height="8" />
        <rect x="20" y="28" width="8" height="8" />
        <path d="M 36 28v 8h 8a 8 8, 0, 0, 0, -8 -8" transform="rotate(-90,40,32)" />
        <path d="M 4 36v 4a 4 4, 0, 0, 0, 4 4h 4v -4a 4 4, 0, 0, 0, -4 -4" transform="rotate(90,8,40)" />
        <rect x="20" y="36" width="8" height="8" />
        <rect x="28" y="36" width="8" height="8" />
        <path d="M 36 36v 8h 8a 8 8, 0, 0, 0, -8 -8" transform="rotate(90,40,40)" />
    </>,
    "extra-rounded": <>
        <path d="M 4 4v 8h 8a 8 8, 0, 0, 0, -8 -8" transform="rotate(-90,8,8)" />
        <path d="M 12 4v 8h 4a 4 4, 0, 0, 0, 0 -8" />
        <circle cx="40" cy="8" r="4" />
        <rect x="4" y="12" width="8" height="8" />
        <circle cx="32" cy="16" r="4" />
        <path d="M 4 20v 8h 8a 8 8, 0, 0, 0, -8 -8" transform="rotate(180,8,24)" />
        <rect x="12" y="20" width="8" height="8" />
        <path d="M 20 20v 8h 8a 8 8, 0, 0, 0, -8 -8" />
        <rect x="20" y="28" width="8" height="8" />
        <path d="M 36 28v 8h 4a 4 4, 0, 0, 0, 0 -8" transform="rotate(-90,40,32)" />
        <circle cx="8" cy="40" r="4" />
        <path d="M 20 36v 8h 8a 8 8, 0, 0, 0, -8 -8" transform="rotate(180,24,40)" />
        <rect x="28" y="36" width="8" height="8" />
        <path d="M 36 36v 8h 8a 8 8, 0, 0, 0, -8 -8" transform="rotate(90,40,40)" />
    </>,
};

export type ShapePart = "dots" | "outer" | "inner";

export default function ShapeSample({ part, value }: { part: ShapePart; value: string }) {
    return (
        <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true" focusable="false">
            {part === "dots" ? dots[value] : (
                <path d={cornerPath(part, value as CornerType)} fillRule="evenodd"
                    transform={`translate(3 3) scale(${part === "outer" ? 6 : 14})`} />
            )}
        </svg>
    );
}
