import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

/**
 * Label plus error plus hint wrapper for every form control.
 * Use everywhere so error styling stays consistent.
 */
export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block font-bold">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}
      {!error && hint ? <p className="mt-1.5 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

/** Shared input style. Import to keep inputs identical app-wide. */
export const inputStyles =
  "min-h-12 w-full rounded-[14px] border border-line bg-surface px-3.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50";
