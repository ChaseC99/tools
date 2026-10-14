export default function BorderSample({ kind, value }: { kind: "spacing" | "radius"; value: number }) {
    const inset = 2 + 24 * Math.min(20, Math.max(0, value)) / 100;
    const radius = 22 * Math.min(25, Math.max(0, value)) / 25;

    return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        {kind === "spacing" ? <>
            <rect x="4" y="4" width="24" height="24" strokeWidth="1.5" opacity="0.45" />
            <rect x={4 + inset} y={4 + inset} width={24 - 2 * inset} height={24 - 2 * inset} fill="currentColor" stroke="none" />
        </> : <path d={`M4 28V${4 + radius}Q4 4 ${4 + radius} 4H28`} />}
    </svg>;
}
