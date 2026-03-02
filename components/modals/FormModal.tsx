'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import CloseIcon from "../icons/CloseIcon";
import { useData } from "../../contexts/DataContext";

interface FormModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialState: T;
  onSubmit: (data: T) => Promise<any>;
  children: (
    formData: T, 
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void,
    setFormData: React.Dispatch<React.SetStateAction<T>>
  ) => React.ReactNode;
  submitText?: string;
  successMessage?: string;
}

function FormModal<T extends object>({
  isOpen,
  onClose,
  title,
  initialState,
  onSubmit,
  children,
  submitText = 'Save',
  successMessage = 'Record created successfully! The dashboard will now refresh.'
}: FormModalProps<T>) {
  const { refetchData } = useData();
  const [isShowing, setIsShowing] = useState(false);
  const [formData, setFormData] = useState<T>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialState);
      setSubmitError('');
      setIsSubmitting(false);
    }
  }, [isOpen, initialState]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value } as T));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(formData);
      alert(successMessage);
      refetchData();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'An unknown error occurred. Please check the console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;

  return createPortal(
    <div
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 flex justify-center items-start p-4 sm:py-16 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
        <div
            className={`relative bg-white rounded-xl shadow-xl w-full max-w-lg sm:max-w-4xl max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out ${isShowing ? 'opacity-100 -translate-y-0' : 'opacity-0 -translate-y-4'}`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="sticky top-0 bg-white/80 backdrop-blur-sm p-6 border-b border-gray-200 flex justify-between items-center z-10">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
                    aria-label={`Close ${title} form`}
                >
                    <CloseIcon />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
                <div className="space-y-6">
                    {children(formData, handleChange, setFormData)}
                    {submitError && (
                        <div className="bg-rose-50 border-l-4 border-rose-400 text-rose-800 p-4 rounded-md text-sm" role="alert">
                            <p className="font-bold">Could not save record</p>
                            <p>{submitError}</p>
                        </div>
                    )}
                </div>
                 <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm pt-5 pb-3 mt-6 border-t border-gray-200 flex justify-end gap-3 z-10 -mx-6 px-6">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-md border border-gray-300 transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md transition shadow-sm disabled:bg-slate-400 disabled:cursor-wait flex items-center"
                    >
                        {isSubmitting && (
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {isSubmitting ? 'Saving...' : submitText}
                    </button>
                </div>
            </form>
        </div>
    </div>,
    document.body
  );
}

export default React.memo(FormModal) as typeof FormModal;
