'use client';

import React from 'react';
import { Printer, ChevronLeft, Save } from 'lucide-react';
import Spinner from "../common/Spinner";

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
  saveButtonText = 'Save & Generate',
  children,
  leftActions,
  rightActions,
}) => {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Creator Header — flex-shrink-0 so it never scrolls away */}
      <header className="flex-shrink-0 bg-card/80 backdrop-blur-md border-b border-border/60 screen-only">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">

          {/* Navigation & Title */}
          <div className="flex items-center gap-6 min-w-0">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-brand-500 transition-colors group py-2"
            >
              <div className="p-1.5 rounded-lg bg-muted group-hover:bg-brand-500/10 transition-colors">
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </div>
              <span className="text-sm font-bold hidden sm:inline uppercase tracking-widest text-[10px]">Back</span>
            </button>

            <div className="h-8 w-px bg-border hidden sm:block" />

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate tracking-tight">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground font-medium truncate">{subtitle}</p>}
            </div>

            <div className="hidden lg:flex items-center">
              {leftActions}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {rightActions ? rightActions : (
              <>
                {onPrint && (
                  <button onClick={onPrint} className="bg-card hover:bg-muted text-foreground font-bold py-2.5 px-5 rounded-xl border border-border transition-all flex items-center gap-2 shadow-sm active:scale-95">
                    <Printer className="w-4 h-4 text-muted-foreground" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                )}
                <button
                  onClick={onSave}
                  disabled={isSubmitting}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all disabled:bg-muted shadow-lg shadow-brand-500/20 flex items-center gap-2 min-w-[120px] sm:min-w-[200px] justify-center active:scale-95"
                >
                  {isSubmitting ? (
                    <Spinner size="sm" color="white" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{saveButtonText}</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative bg-background">
        {/* Mobile Header Actions (Visible only on small screens if provided) */}
        <div className="lg:hidden p-4 pb-0">
          {leftActions}
        </div>

        <div className="p-4 sm:p-6 lg:p-10 h-full">
          <div className="max-w-[1920px] mx-auto h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditorContainer;

