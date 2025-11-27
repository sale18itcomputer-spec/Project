import React from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { LayoutDashboard, Filter, Building, Users, FileText } from 'lucide-react';

const navItems = [
    { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={24} /> },
    { view: 'projects', label: 'Pipelines', icon: <Filter size={24} /> },
    { view: 'companies', label: 'Companies', icon: <Building size={24} /> },
    { view: 'contacts', label: 'Contacts', icon: <Users size={24} /> },
    { view: 'quotations', label: 'Quotes', icon: <FileText size={24} /> },
];

const MobileBottomNav: React.FC = () => {
    const { navigation, handleNavigation } = useNavigation();

    return (
        <nav className="mobile-bottom-nav lg:hidden">
            {navItems.map(item => {
                const isActive = navigation.view === item.view;
                return (
                    <button
                        key={item.view}
                        onClick={() => handleNavigation({ view: item.view })}
                        className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        {item.icon}
                        <span className="mobile-nav-item-label">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
};

export default MobileBottomNav;