import React from 'react';
// FIX: Replaced non-modular local icon import with an icon from the 'lucide-react' library.
import { Pencil } from 'lucide-react';

interface ModalActionFooterProps {
  onClose: () => void;
  onEdit: () => void;
}

const ModalActionFooter: React.FC<ModalActionFooterProps> = ({
  onClose,
  onEdit,
}) => {
  return (
    <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm pt-4 pb-4 border-t border-gray-200 flex justify-end items-center z-10 px-6 gap-3">
      {/* Neutral Action: Outlined gray button */}
      <button onClick={onClose} className="font-semibold py-2 px-4 rounded-lg transition-colors duration-200 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
        Close
      </button>
      {/* Primary Action: Solid blue button */}
      <button 
        onClick={onEdit} 
        className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg transition shadow-sm flex items-center gap-2"
      >
        <Pencil className="w-5 h-5" />
        Edit
      </button>
    </div>
  );
};

export default React.memo(ModalActionFooter);