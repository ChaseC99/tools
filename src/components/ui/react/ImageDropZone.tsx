import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

export type ImageDropZoneProps = {
    onFile: (file: File) => void;
    dragging: boolean;
    onDraggingChange: (dragging: boolean) => void;
    accept?: string;
    theme?: "light" | "dark";
    children: ReactNode;
    style?: CSSProperties;
    label?: string;
    className?: string;
    disabled?: boolean;
};

export default function ImageDropZone({
    onFile,
    dragging,
    onDraggingChange,
    accept = "image/*",
    theme,
    children,
    style,
    label = "Choose a file or drop it here",
    className = "",
    disabled = false,
}: ImageDropZoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openFilePicker = () => {
        if (!disabled) fileInputRef.current?.click();
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        onDraggingChange(false);
        if (disabled) return;
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const file = event.target.files?.[0];
        if (file) onFile(file);
        event.target.value = "";
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openFilePicker();
        }
    };

    return (
        <div
            className={["ui-dropzone", className].filter(Boolean).join(" ")}
            data-dragging={dragging}
            data-theme={theme}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={label}
            aria-disabled={disabled || undefined}
            onDragOver={(event) => {
                event.preventDefault();
                if (!disabled) onDraggingChange(true);
            }}
            onDragLeave={() => onDraggingChange(false)}
            onDrop={handleDrop}
            onClick={openFilePicker}
            onKeyDown={handleKeyDown}
            style={style}
        >
            {children}
            <input
                ref={fileInputRef}
                className="ui-dropzone-input"
                type="file"
                accept={accept}
                onChange={handleInputChange}
                disabled={disabled}
                tabIndex={-1}
            />
        </div>
    );
}
