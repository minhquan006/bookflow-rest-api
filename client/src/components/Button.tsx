import type { ButtonHTMLAttributes } from "react";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean };

export function Button({
  busy = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className="button"
      type="button"
      {...props}
      disabled={disabled || busy}
      aria-busy={busy}
    >
      {busy && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
