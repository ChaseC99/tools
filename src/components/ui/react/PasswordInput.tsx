import { useId, useState, type InputHTMLAttributes } from "react";

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export default function PasswordInput({ id, className = "", disabled, ...props }: PasswordInputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    const action = visible ? "Hide password" : "Show password";

    return <div className="ui-password-input">
        <input {...props} id={inputId} className={`ui-input ${className}`.trim()}
            type={visible ? "text" : "password"} disabled={disabled} />
        <button type="button" className="ui-password-toggle" disabled={disabled}
            aria-label={action} title={action} aria-controls={inputId}
            onClick={() => setVisible(current => !current)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
                {visible && <path d="m3 3 18 18" />}
            </svg>
        </button>
    </div>;
}
