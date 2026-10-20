import { useId } from "react";
import type { InputHTMLAttributes } from "react";
type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({
  label,
  error,
  hint,
  id: providedId,
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const descriptionId = `${id}-description`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? descriptionId : undefined}
      />
      {(error || hint) && (
        <p id={descriptionId} className={error ? "field-error" : "field-hint"}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
