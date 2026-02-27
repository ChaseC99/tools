type SpinnerProps = {
    size?: number;
    color?: string;
};

export default function Spinner({ size = 24, color = "#4a90d9" }: SpinnerProps) {
    return (
        <>
            <style>{`@keyframes shared-spin { to { transform: rotate(360deg); } }`}</style>
            <div
                style={{
                    display: "inline-block",
                    width: size,
                    height: size,
                    border: "3px solid rgba(255,255,255,0.1)",
                    borderTopColor: color,
                    borderRadius: "50%",
                    animation: "shared-spin 0.8s linear infinite",
                }}
            />
        </>
    );
}
