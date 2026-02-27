import { useRef, type ReactNode } from "react";

type ImageDropZoneProps = {
    onFile: (file: File) => void;
    dragging: boolean;
    onDraggingChange: (dragging: boolean) => void;
    accept?: string;
    theme?: "light" | "dark";
    children: ReactNode;
    style?: React.CSSProperties;
};

export default function ImageDropZone({
    onFile,
    dragging,
    onDraggingChange,
    accept = "image/*",
    theme = "light",
    children,
    style,
}: ImageDropZoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        onDraggingChange(true);
    };

    const handleDragLeave = () => onDraggingChange(false);

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        onDraggingChange(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
    };

    const handleClick = () => fileInputRef.current?.click();

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
        event.target.value = "";
    };

    const baseBorderColor = theme === "dark" ? "#555" : "#d0d7de";
    const baseBg = theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "#f8fafc";
    const draggingBg = theme === "dark" ? "rgba(74, 144, 217, 0.1)" : "rgba(74, 144, 217, 0.08)";

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            style={{
                border: `2px dashed ${dragging ? "#4a90d9" : baseBorderColor}`,
                borderRadius: 10,
                padding: "1.25rem",
                textAlign: "center",
                cursor: "pointer",
                background: dragging ? draggingBg : baseBg,
                transition: "all 0.2s",
                ...style,
            }}
        >
            {children}
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleInputChange}
                style={{ display: "none" }}
            />
        </div>
    );
}
