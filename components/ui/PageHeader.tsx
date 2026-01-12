import { HTMLAttributes, forwardRef } from 'react';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, description, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mb-8 ${className}`.trim()}
        {...props}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-gray-600">
                {description}
              </p>
            )}
          </div>
          {children && (
            <div className="flex items-center gap-3">
              {children}
            </div>
          )}
        </div>
      </div>
    );
  }
);

PageHeader.displayName = 'PageHeader';

export { PageHeader };
export type { PageHeaderProps };
