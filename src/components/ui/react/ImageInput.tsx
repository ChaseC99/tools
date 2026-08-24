import type { CSSProperties } from "react";
import ImageDropZone from "./ImageDropZone";
import Spinner from "./Spinner";

export type ImageInputProps = {
    onFile: (file: File) => void;
    dragging: boolean;
    onDraggingChange: (dragging: boolean) => void;
    accept?: string;
    theme?: "light" | "dark";
    title?: string;
    formats?: string[];
    maxFileSize?: string;
    fileName?: string | null;
    previewUrl?: string | null;
    previewAlt?: string;
    actionLabel?: string;
    replaceLabel?: string;
    loading?: boolean;
    loadingLabel?: string;
    label?: string;
    className?: string;
    style?: CSSProperties;
    disabled?: boolean;
};

export default function ImageInput({
    onFile,
    dragging,
    onDraggingChange,
    accept = "image/*",
    theme,
    title = "Choose an image",
    formats = [],
    maxFileSize,
    fileName,
    previewUrl,
    previewAlt = "Selected image preview",
    actionLabel = "Browse",
    replaceLabel = "Replace",
    loading = false,
    loadingLabel = "Loading image…",
    label,
    className = "",
    style,
    disabled = false,
}: ImageInputProps) {
    const hasFile = Boolean(fileName || previewUrl);
    const stateClass = loading ? "is-loading" : hasFile ? "is-populated" : "is-empty";
    const formatText = formats.length > 1
        ? `${formats.slice(0, -1).join(", ")}, or ${formats[formats.length - 1]}`
        : formats[0];
    const supportText = [formatText, maxFileSize ? `Up to ${maxFileSize}` : null].filter(Boolean).join(" · ");
    const controlTitle = dragging ? "Drop image to upload" : hasFile ? fileName || "Selected image" : title;
    const accessibleLabel = label ?? [
        hasFile ? `${replaceLabel}: ${fileName ?? "selected image"}` : `${actionLabel}. ${title}`,
        formatText ? `Supported formats: ${formatText}` : null,
        maxFileSize ? `Maximum file size: ${maxFileSize}` : null,
    ].filter(Boolean).join(". ");

    return (
        <div className="ui-image-input-field" data-theme={theme}>
            <ImageDropZone
                onFile={onFile}
                dragging={dragging}
                onDraggingChange={onDraggingChange}
                accept={accept}
                theme={theme}
                label={accessibleLabel}
                className={["ui-image-input", stateClass, className].filter(Boolean).join(" ")}
                style={style}
                disabled={disabled || loading}
            >
                <span className="ui-image-input__visual" aria-hidden="true">
                    {previewUrl ? (
                        <img src={previewUrl} alt={previewAlt} />
                    ) : loading ? (
                        <Spinner size={24} />
                    ) : (
                        <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M4.75 4.75h14.5v14.5H4.75z" />
                            <circle cx="9" cy="9" r="1.5" />
                            <path d="m6.75 17 3.4-3.4 2.35 2.35 1.85-1.85 2.9 2.9" />
                        </svg>
                    )}
                </span>

                <span className="ui-image-input__content" aria-live="polite">
                    <strong className="ui-image-input__title">
                        {loading ? loadingLabel : controlTitle}
                    </strong>
                </span>

                {!loading && (
                    <span className="ui-image-input__action" aria-hidden="true">
                        {hasFile ? replaceLabel : actionLabel}
                    </span>
                )}
            </ImageDropZone>
            {supportText && <p className="ui-image-input__support">{supportText}</p>}
        </div>
    );
}
