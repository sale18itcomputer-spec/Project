import React from 'react';

const BrandedLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
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
          border: 4px solid rgba(0, 74, 173, 0.1);
          border-left-color: #004aad;
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
      <p className="mt-6 text-lg text-slate-600 font-medium">
        Loading Dashboard...
      </p>
    </div>
  );
};

export default BrandedLoader;
