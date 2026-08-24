import type { CSSProperties } from "react";

export type SpinnerProps = {
    size?: number;
    color?: string;
};

export default function Spinner({ size = 24, color }: SpinnerProps) {
    const style: CSSProperties = {
        width: size,
        height: size,
        ...(color ? { borderTopColor: color } : {}),
    };

    return <span className="ui-spinner" style={style} role="status" aria-label="Loading" />;
}
