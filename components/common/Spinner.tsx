import React from 'react';

interface SpinnerProps {
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    color?: 'brand' | 'white' | 'slate' | 'current';
}

const Spinner: React.FC<SpinnerProps> = ({
    className = '',
    size = 'md',
    color = 'brand'
}) => {
    const sizeMap = {
        xs: 12,
        sm: 16,
        md: 32,
        lg: 48,
        xl: 64
    };

    const colorMap = {
        brand: '#004aad',
        white: '#ffffff',
        slate: '#64748b',
        current: 'currentColor'
    };

    const s = sizeMap[size];
    const c = colorMap[color];

    return (
        <div className={`flex items-center justify-center ${className}`} role="status" aria-live="polite">
            <svg
                width={s}
                height={s}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="animate-spin"
                style={{ animationDuration: '0.8s' }}
            >
                <defs>
                    <linearGradient id={`spinner-gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={c} stopOpacity="1" />
                        <stop offset="100%" stopColor={c} stopOpacity="0.3" />
                    </linearGradient>
                </defs>
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke={c}
                    strokeWidth="2.5"
                    opacity="0.15"
                />
                <path
                    d="M12,2A10,10,0,0,1,22,12"
                    fill="none"
                    stroke={`url(#spinner-gradient-${color})`}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
            </svg>
            <span className="sr-only">Loading...</span>
        </div>
    );
};

export default Spinner;
