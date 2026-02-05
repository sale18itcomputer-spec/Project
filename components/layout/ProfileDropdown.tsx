import React, { useState, useEffect } from 'react';
import { User } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
// FIX: Replaced non-modular local icon imports with icons from the 'lucide-react' library.
import { LogOut, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { transformToDirectImageUrl } from "../../utils/imageUrl";

interface ProfileDropdownProps {
  isOpen: boolean;
  user: User | null;
}

const AvatarChecker: React.FC<{ user: User }> = ({ user }) => {
    const [avatarStatus, setAvatarStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    
    const directUrl = transformToDirectImageUrl(user.Picture);

    useEffect(() => {
        if (!user?.Picture) {
            setAvatarStatus('error');
            setErrorMessage("The 'Picture' cell in your Google Sheet is empty. Please add a URL to an image.");
            return;
        }

        setAvatarStatus('loading');
        setErrorMessage('');

        if (!directUrl) {
            setAvatarStatus('error');
            setErrorMessage("Could not process the URL provided in the 'Picture' field.");
            return;
        }
        
        // Use a cache-busting query parameter to ensure the browser fetches a fresh image
        const cacheBustedUrl = `${directUrl}${directUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
        
        const img = new Image();
        img.onload = () => setAvatarStatus('success');
        img.onerror = () => {
             setAvatarStatus('error');
             const originalUrl = user.Picture || '';
             let advice = 'The image failed to load. Please check that the URL is correct and the image is publicly accessible.';
             
             if (originalUrl.includes('imgur.com')) {
                 advice = 'The image from Imgur failed to load. This can happen if the image was deleted, is private, or the link is incorrect.';
             } else if (originalUrl.includes('drive.google.com')) {
                 advice = 'The image from Google Drive failed to load. Please ensure the file sharing permission is set to "Anyone with the link".';
             }
             
             setErrorMessage(advice);
        };
        img.src = cacheBustedUrl;
        img.referrerPolicy = 'no-referrer';

    }, [user, directUrl]);

    const renderContent = () => {
        switch (avatarStatus) {
            case 'loading':
                return (
                     <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-md">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-400"></div>
                        <span className="text-slate-600">Checking avatar link...</span>
                    </div>
                );
            case 'success':
                 return (
                    <div className="flex items-center gap-3 p-2 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200">
                        <img src={directUrl} alt="Avatar Preview" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                        <div className="flex-1">
                            <div className="font-semibold flex items-center gap-1.5">
                               <CheckCircle className="w-4 h-4" />
                               Avatar is working!
                            </div>
                        </div>
                    </div>
                );
            case 'error':
                 return (
                    <div className="p-3 bg-rose-50 text-rose-900 rounded-md border border-rose-200 space-y-2">
                        <div className="font-semibold flex items-center gap-1.5">
                           <AlertTriangle className="w-4 h-4" />
                           Avatar failed to load
                        </div>
                        <p className="text-xs text-rose-800 leading-relaxed whitespace-pre-wrap">{errorMessage}</p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="text-xs">
            <h4 className="font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-400" />
                Avatar Preview &amp; Troubleshooter
            </h4>
            {renderContent()}
        </div>
    );
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ isOpen, user }) => {
    const { logout } = useAuth();
    
    if (!isOpen) return null;
    
    return (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 origin-top-right z-20 animate-contentFadeIn" style={{animationDuration: '0.2s'}}>
            <div className="p-4 border-b border-slate-100">
                <p className="font-semibold text-slate-800 truncate">{user?.Name || 'User'}</p>
                <p className="text-sm text-slate-500 truncate">{user?.Role || 'Role'}</p>
            </div>
            
            {user && (
                <div className="p-4 border-b border-slate-100">
                    <AvatarChecker user={user} />
                </div>
            )}

            <ul>
                <li>
                    <button 
                        onClick={logout}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-rose-600 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </li>
            </ul>
        </div>
    );
};

export default ProfileDropdown;