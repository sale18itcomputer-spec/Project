import React from 'react';

interface AvatarProps {
  name: string;
  showName?: boolean;
  className?: string;
}

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500'
];

// Simple hash function to get a consistent color for a given name
const getColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
};

const getInitials = (name: string): string => {
  if (!name || typeof name !== 'string') return '?';
  const names = name.split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({ name, showName = true, className }) => {
  const initials = getInitials(name);
  const color = getColor(name);

  const avatarCircle = (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${color} flex-shrink-0 ${className || ''}`}>
      {initials}
    </div>
  );

  if (!showName) {
    return avatarCircle;
  }

  return (
    <div className="flex items-center space-x-3">
      {avatarCircle}
      <span className="font-semibold text-gray-800 hidden md:inline truncate">{name}</span>
    </div>
  );
};

export default React.memo(Avatar);