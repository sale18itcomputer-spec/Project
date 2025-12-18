import React from 'react';
import { Printer } from 'lucide-react';

interface DocumentEditorContainerProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onSave: () => void;
  onPrint?: () => void;
  isSubmitting: boolean;
  saveButtonText?: string;
  children: React.ReactNode;
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
}

const DocumentEditorContainer: React.FC<DocumentEditorContainerProps> = ({
  title,
  subtitle,
  onBack,
  onSave,
  onPrint,
  isSubmitting,
  saveButtonText = 'Save & Generate File',
  children,
  leftActions,
  rightActions,
}) => {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Sticky Header */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-sm p-4 sm:p-6 border-b border-slate-200 sticky top-0 z-10 screen-only">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <button onClick={onBack} className="text-sm font-semibold text-brand-700 hover:underline">&larr; Back to Dashboard</button>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mt-1 truncate">{title}</h1>
              {subtitle && <p className="text-base lg:text-lg text-slate-500 font-medium truncate">{subtitle}</p>}
            </div>
            {leftActions}
          </div>
          <div className="flex items-center gap-3">
            {rightActions ? rightActions : (
              <>
                {onPrint && (
                  <button onClick={onPrint} className="bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2 px-4 rounded-md border border-slate-300 transition flex items-center gap-2 shadow-sm">
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                )}
                <button onClick={onSave} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md transition disabled:bg-slate-400 shadow-sm flex items-center gap-2 min-w-[150px] sm:min-w-[180px] justify-center">
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">{saveButtonText}</span>
                      <span className="sm:hidden">Save</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8">
        {children}
      </div>
    </div>
  );
};

export default DocumentEditorContainer;