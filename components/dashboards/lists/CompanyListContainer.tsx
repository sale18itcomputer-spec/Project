'use client';

import React from 'react';
import { Company } from "../../../types";
import Spinner from "../../common/Spinner";
import EmptyState from "../../common/EmptyState";
import { Building } from 'lucide-react';

interface CompanyListContainerProps {
    companies: Company[];
    selectedCompanyId: string | null;
    onSelectCompany: (id: string) => void;
    loading: boolean;
}

const CompanyListContainer: React.FC<CompanyListContainerProps> = ({ companies, selectedCompanyId, onSelectCompany, loading }) => {

    const renderContent = () => {
        if (loading) {
            return <Spinner />;
        }

        if (companies.length === 0) {
            return (
                <div className="p-8 h-full flex items-center justify-center">
                    <EmptyState illustration={<Building className="w-16 h-16 text-slate-300" />}>
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">No Companies Found</h3>
                        <p className="mt-1 text-sm text-gray-500">Try adjusting your search query.</p>
                    </EmptyState>
                </div>
            );
        }

        return (
            <ul>
                {companies.map(company => (
                    <li key={company['Company ID']}>
                        <button
                            onClick={() => onSelectCompany(company['Company ID'])}
                            className={`w-full text-left px-4 py-3.5 border-b border-slate-100 border-l-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 z-10 relative ${selectedCompanyId === company['Company ID']
                                    ? 'bg-brand-50 border-brand-500'
                                    : 'border-transparent hover:bg-slate-100'
                                }`}
                        >
                            <h3 className={`truncate text-base ${selectedCompanyId === company['Company ID']
                                    ? 'font-bold text-brand-800'
                                    : 'font-semibold text-slate-800'
                                }`}>
                                {company['Company Name']}
                            </h3>
                            <p className="text-sm text-slate-600 truncate mt-0.5">{company.Field || 'No industry specified'}</p>
                        </button>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto vertical-scroll">
            {renderContent()}
        </div>
    );
};

export default CompanyListContainer;
