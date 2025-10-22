import React from 'react';
import { IconProps } from './IconProps';

interface SortIconProps extends IconProps {
  direction: 'ascending' | 'descending' | null;
}

const SortIcon: React.FC<SortIconProps> = ({ direction, className }) => (
  <div className={`flex flex-col ${className}`}>
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-2 w-2 ${direction === 'ascending' ? 'text-white' : 'text-white/50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-2 w-2 ${direction === 'descending' ? 'text-white' : 'text-white/50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </div>
);

export default SortIcon;
