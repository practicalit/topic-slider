"use client";

type Props = {
  message: string;
  /** default error (red); warning uses amber for soft restrictions */
  variant?: "error" | "warning";
  className?: string;
  onDismiss?: () => void;
};

export function ApiErrorAlert({ message, variant = "error", className = "", onDismiss }: Props) {
  if (!message.trim()) return null;

  const box =
    variant === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${box} ${className}`}
    >
      <div className="flex gap-3 justify-between items-start">
        <p className="flex-1">{message}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs font-semibold underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
