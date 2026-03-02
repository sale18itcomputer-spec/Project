'use client';

// Add ambient type declarations for the Google Maps API to resolve type errors without requiring @types/google.maps.
declare namespace google.maps {
    type Map = any;
    type Marker = any;
    type Geocoder = any;
    type LatLng = any;
    type MapMouseEvent = any;
}

// This allows accessing window.google.
declare global {
    interface Window {
        google: any;
    }
}
import React, { useRef, useEffect, useState } from 'react';

// A simple target icon for "Get Current Location"
const MyLocationIcon: React.FC<{className?: string}> = ({ className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="3"></circle>
        <line x1="12" y1="2" x2="12" y2="4"></line>
        <line x1="12" y1="20" x2="12" y2="22"></line>
        <line x1="20" y1="12" x2="22" y2="12"></line>
        <line x1="2" y1="12" x2="4" y2="12"></line>
    </svg>
);

export interface MapLocation {
    lat: number;
    lng: number;
    name: string;
}

interface InteractiveMapProps {
    onLocationChange: (location: MapLocation) => void;
    initialData?: Partial<MapLocation>;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onLocationChange, initialData }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [marker, setMarker] = useState<google.maps.Marker | null>(null);
    
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);
    
    // Initialize map and marker
    useEffect(() => {
        if (mapRef.current && window.google) {
            const initialCenter = (initialData?.lat && initialData?.lng) 
                ? { lat: initialData.lat, lng: initialData.lng } 
                : { lat: 11.5564, lng: 104.9282 }; // Default to Phnom Penh

            const newMap = new window.google.maps.Map(mapRef.current, {
                center: initialCenter,
                zoom: (initialData?.lat && initialData?.lng) ? 15 : 12,
                mapTypeControl: false,
                streetViewControl: false,
            });
            setMap(newMap);

            const newMarker = new window.google.maps.Marker({
                map: newMap,
                draggable: true,
            });

            if (initialData?.lat && initialData?.lng) {
                newMarker.setPosition(initialCenter);
            }
            
            setMarker(newMarker);
            geocoderRef.current = new window.google.maps.Geocoder();
        }
    }, []); // Run only once

    // Helper to perform reverse geocoding and update parent state
    const updateLocationFromLatLng = (latLng: google.maps.LatLng) => {
        if (!geocoderRef.current) return;

        geocoderRef.current.geocode({ location: latLng }, (results, status) => {
            const lat = latLng.lat();
            const lng = latLng.lng();
            let name = `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`; // Fallback name
            if (status === 'OK' && results && results[0]) {
                name = results[0].formatted_address;
            }
            onLocationChange({ lat, lng, name });
        });
    };
    
    // Set up event listeners for map and marker
    useEffect(() => {
        if (!map || !marker) return;

        const mapClickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
                marker.setPosition(e.latLng);
                updateLocationFromLatLng(e.latLng);
            }
        });

        const markerDragListener = marker.addListener('dragend', () => {
            const position = marker.getPosition();
            if (position) {
                updateLocationFromLatLng(position);
            }
        });

        return () => {
            window.google.maps.event.removeListener(mapClickListener);
            window.google.maps.event.removeListener(markerDragListener);
        }

    }, [map, marker]);

    // Initialize search box
    useEffect(() => {
        if (map && marker && searchInputRef.current && window.google) {
            const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
                 fields: ["name", "geometry.location", "formatted_address"]
            });
            autocomplete.bindTo('bounds', map);
            
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry && place.geometry.location) {
                    map.setCenter(place.geometry.location);
                    map.setZoom(17);
                    marker.setPosition(place.geometry.location);
                    
                    const lat = place.geometry.location.lat();
                    const lng = place.geometry.location.lng();
                    const name = place.formatted_address || place.name || '';
                    onLocationChange({ lat, lng, name });

                } else if (searchInputRef.current) {
                    // User entered a place that was not suggested and pressed Enter.
                    window.alert("Could not find details for: '" + searchInputRef.current.value + "'");
                }
            });
        }
    }, [map, marker]);
    
    // Update search input when initialData name changes (e.g. from parent form)
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.value = initialData?.name || '';
        }
    }, [initialData?.name]);

    const handleGetCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = new window.google.maps.LatLng(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                    map?.setCenter(pos);
                    map?.setZoom(17);
                    marker?.setPosition(pos);
                    updateLocationFromLatLng(pos);
                },
                () => {
                    alert('Error: The Geolocation service failed. Please check browser permissions.');
                }
            );
        } else {
            alert("Error: Your browser doesn't support geolocation.");
        }
    };


    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search for a location or click on the map"
                    className="flex-grow w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-md border border-slate-300 transition shadow-sm"
                    title="Get current location"
                >
                    <MyLocationIcon />
                </button>
            </div>
            <div ref={mapRef} style={{ height: '350px' }} className="rounded-md border border-gray-300 bg-slate-100" />
        </div>
    );
};

export default InteractiveMap;
