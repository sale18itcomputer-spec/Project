import React from 'react';

const BrandedLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .spinner-branded {
          display: inline-block;
          width: 50px;
          height: 50px;
          border: 4px solid hsl(var(--brand-600) / 0.15);
          border-left-color: hsl(var(--brand-600));
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
      `}</style>
      <img 
        src="https://i.imgur.com/Hur36Vc.png" 
        alt="L'IMPERIAL TECHNOLOGY Logo" 
        className="h-12 w-auto mb-8"
      />
      <div className="spinner-branded"></div>
      <p className="mt-6 text-lg text-muted-foreground font-medium">
        Loading Dashboard...
      </p>
    </div>
  );
};

export default BrandedLoader;
