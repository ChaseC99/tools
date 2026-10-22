import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

// Shared across inputs so a page-wide paste is delivered to exactly one picker.
const pasteTargets = new Set<HTMLDivElement>();
let lastPasteTarget: HTMLDivElement | null = null;

export type ImageDropZoneProps = {
    onFile: (file: File) => void;
    dragging: boolean;
    onDraggingChange: (dragging: boolean) => void;
    accept?: string;
    theme?: "light" | "dark";
    children: ReactNode | ((openFilePicker: () => void) => ReactNode);
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
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const hasActions = typeof children === "function";

    const selectPasteTarget = () => {
        if (!disabled) lastPasteTarget = dropZoneRef.current;
    };

    useEffect(() => {
        const element = dropZoneRef.current;
        if (!element) return;
        pasteTargets.add(element);
        return () => {
            pasteTargets.delete(element);
            if (lastPasteTarget === element) lastPasteTarget = null;
        };
    }, []);

    useEffect(() => {
        const element = dropZoneRef.current;
        if (!element || disabled) return;

        const handlePaste = (event: ClipboardEvent) => {
            if (event.defaultPrevented) return;
            // Preserve normal paste in editors, including nested editable content.
            if (event.composedPath().some((target) => target instanceof HTMLElement && (
                target.matches('input, textarea, select, [role="textbox"]') || target.isContentEditable
            ))) return;

            const available = [...pasteTargets].filter((target) =>
                target.ownerDocument === element.ownerDocument &&
                target.getAttribute("aria-disabled") !== "true" &&
                !target.closest("[inert]") &&
                target.getClientRects().length > 0 &&
                getComputedStyle(target).visibility === "visible"
            );
            const selected = available.includes(lastPasteTarget)
                ? lastPasteTarget
                : available.length === 1 ? available[0] : null;
            if (selected !== element) return;

            const file = Array.from(event.clipboardData?.files ?? [])
                .find((file) => file.type.startsWith("image/"));
            if (!file) return;

            event.preventDefault();
            // Use the same validation and processing as browsing or dropping a file.
            onFile(file);
        };

        element.ownerDocument.addEventListener("paste", handlePaste);
        return () => element.ownerDocument.removeEventListener("paste", handlePaste);
    }, [disabled, onFile]);

    const openFilePicker = () => {
        if (!disabled) {
            selectPasteTarget();
            fileInputRef.current?.click();
        }
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        onDraggingChange(false);
        if (disabled) return;
        selectPasteTarget();
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
            ref={dropZoneRef}
            className={["ui-dropzone", className].filter(Boolean).join(" ")}
            data-dragging={dragging}
            data-theme={theme}
            role={hasActions ? "group" : "button"}
            tabIndex={disabled ? -1 : 0}
            aria-label={label}
            aria-disabled={disabled || undefined}
            onFocusCapture={selectPasteTarget}
            onPointerDownCapture={selectPasteTarget}
            onDragOver={(event) => {
                event.preventDefault();
                if (!disabled) onDraggingChange(true);
            }}
            onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDraggingChange(false);
            }}
            onDrop={handleDrop}
            onClick={hasActions ? undefined : openFilePicker}
            onKeyDown={hasActions ? undefined : handleKeyDown}
            style={style}
        >
            {typeof children === "function" ? children(openFilePicker) : children}
            <input
                ref={fileInputRef}
                className="ui-dropzone-input"
                type="file"
                accept={accept}
                onChange={handleInputChange}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
            />
        </div>
    );
}
