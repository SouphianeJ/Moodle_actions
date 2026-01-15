import { InputHTMLAttributes, forwardRef } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <label
        htmlFor={inputId}
        className={`
          flex items-center gap-3 cursor-pointer select-none
          ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `.trim()}
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={`
            h-4 w-4 rounded border-gray-300
            text-blue-600 
            focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:cursor-not-allowed
          `.trim()}
          {...props}
        />
        {label && (
          <span className="text-sm text-gray-700">
            {label}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
export type { CheckboxProps };
