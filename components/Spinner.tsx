import React from 'react';

interface SpinnerProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    color?: 'brand' | 'white' | 'slate';
}

const Spinner: React.FC<SpinnerProps> = ({
    className = '',
    size = 'md',
    color = 'brand'
}) => {
    const sizeMap = {
        sm: 16,
        md: 32,
        lg: 48,
        xl: 64
    };

    const colorMap = {
        brand: '#004aad',
        white: '#ffffff',
        slate: '#64748b'
    };

    const s = sizeMap[size];
    const c = colorMap[color];

    return (
        <div className={`flex items-center justify-center ${className}`} role="status">
            <svg
                width={s}
                height={s}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="animate-spin"
            >
                <path
                    d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
                    fill={c}
                    opacity=".15"
                />
                <path
                    d="M12,1A11,11,0,0,1,23,12h-3a8,8,0,0,0-8-8V1Z"
                    fill={c}
                />
            </svg>
            <span className="sr-only">Loading...</span>
        </div>
    );
};

export default Spinner;
