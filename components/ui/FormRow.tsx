import { HTMLAttributes, forwardRef } from 'react';

interface FormRowProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  htmlFor?: string;
}

const FormRow = forwardRef<HTMLDivElement, FormRowProps>(
  ({ label, htmlFor, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mb-4 ${className}`.trim()}
        {...props}
      >
        {label && (
          <label
            htmlFor={htmlFor}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
          </label>
        )}
        {children}
      </div>
    );
  }
);

FormRow.displayName = 'FormRow';

export { FormRow };
export type { FormRowProps };
