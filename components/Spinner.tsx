import React from 'react';

const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'h-8 w-8',
        md: 'h-12 w-12',
        lg: 'h-16 w-16',
    };
    return (
        <div className="flex items-center justify-center p-12">
            <div className={`animate-spin rounded-full border-t-2 border-b-2 border-brand-600 ${sizeClasses[size]}`}></div>
        </div>
    );
};

export default Spinner;