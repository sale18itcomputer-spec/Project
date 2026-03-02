'use client';

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from "../ui/button";

interface ModalActionFooterProps {
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

const ModalActionFooter: React.FC<ModalActionFooterProps> = ({
  onClose,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm pt-4 pb-4 border-t border-gray-200 flex justify-between items-center z-10 px-6 gap-3">
      <div>
        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        )}
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default React.memo(ModalActionFooter);
