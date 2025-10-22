import * as React from 'react';
import { IconProps } from './IconProps';

const ContactsIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className || 'h-6 w-6'}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm6-11a3 3 0 100-6 3 3 0 000 6zM21 21v-1a6 6 0 00-3-5.228" />
  </svg>
);

export default ContactsIcon;
