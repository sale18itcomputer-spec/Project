import React, { useMemo } from 'react';
import { useNavigation } from "../../contexts/NavigationContext";
import { useB2B } from "../../contexts/B2BContext";
import { LayoutDashboard, Filter, Building, Users, FileText } from 'lucide-react';

const allNavItems = [
    { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={24} />, showInB2B: true },
    { view: 'projects', label: 'Pipelines', icon: <Filter size={24} />, showInB2B: true },
    { view: 'companies', label: 'Companies', icon: <Building size={24} />, showInB2B: true },
    { view: 'contacts', label: 'Contacts', icon: <Users size={24} />, showInB2B: false },
    { view: 'quotations', label: 'Quotes', icon: <FileText size={24} />, showInB2B: true },
];

const MobileBottomNav: React.FC = () => {
    const { navigation, handleNavigation } = useNavigation();
    const { isB2B } = useB2B();

    // Filter nav items based on B2B mode
    const navItems = useMemo(() => {
        return allNavItems.filter(item => !isB2B || item.showInB2B);
    }, [isB2B]);

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