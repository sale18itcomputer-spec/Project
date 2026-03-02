'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import InteractiveMap, { MapLocation } from "../dashboards/views/InteractiveMap";
import { X } from 'lucide-react';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceSelected: (placeName: string) => void;
}

const AddPlaceModal: React.FC<AddPlaceModalProps> = ({ isOpen, onClose, onPlaceSelected }) => {
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [editableName, setEditableName] = useState('');

  useEffect(() => {
    if (selectedLocation) {
      setEditableName(selectedLocation.name);
    }
  }, [selectedLocation]);

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedLocation(null);
      setEditableName('');
    }
  }, [isOpen]);

  const mapLink = selectedLocation ? `https://www.google.com/maps/search/?api=1&query=${selectedLocation.lat},${selectedLocation.lng}` : '';

  if (!isOpen) return null;

  const handleAddPlace = () => {
    if (editableName && selectedLocation) {
      onPlaceSelected(`${editableName} - ${mapLink}`);
      onClose();
    } else {
      alert("Please select a location and provide a name.");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Add a Place</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <InteractiveMap onLocationChange={setSelectedLocation} initialData={{ name: editableName }} />
          <div>
            <label htmlFor="place-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
            <input
              type="text"
              id="place-name"
              value={editableName}
              onChange={(e) => setEditableName(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm transition-colors duration-150"
              placeholder="Enter a name for the place"
            />
          </div>
          <div>
            <label htmlFor="map-link" className="block text-sm font-medium text-slate-700 mb-1.5">Google Map Link</label>
            <input
              type="text"
              id="map-link"
              value={mapLink}
              readOnly
              className="block w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-lg sm:text-sm text-slate-500 cursor-not-allowed"
              placeholder="Generated after selecting a location"
            />
          </div>
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-md border border-gray-300 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddPlace}
            disabled={!editableName || !selectedLocation}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-md transition shadow-sm disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            Add Place
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AddPlaceModal;

