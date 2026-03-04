'use client';

import React from 'react';
import { PipelineProject } from "../../../types";
import EmptyState from "../../common/EmptyState";
import { Briefcase } from 'lucide-react';
import { formatCurrencySmartly } from "../../../utils/formatters";

interface PipelineListContainerProps {
    projects: PipelineProject[];
    selectedPipelineNo: string | null;
    onSelectProject: (no: string) => void;
    loading: boolean;
}

const PipelineListSkeleton = () => (
    <div className="divide-y divide-border">
        {[...Array(8)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 animate-pulse">
                <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-2/3 bg-muted rounded"></div>
                        <div className="h-4 w-1/3 bg-muted/50 rounded"></div>
                    </div>
                    <div className="h-5 w-16 bg-muted rounded ml-2"></div>
                </div>
            </div>
        ))}
    </div>
);

const PipelineListContainer: React.FC<PipelineListContainerProps> = ({ projects, selectedPipelineNo, onSelectProject, loading }) => {

    const renderContent = () => {
        if (loading) {
            return <PipelineListSkeleton />;
        }

        if (projects.length === 0) {
            return (
                <div className="p-8 h-full flex items-center justify-center">
                    <EmptyState illustration={<Briefcase className="w-16 h-16 text-muted-foreground/20" />}>
                        <h3 className="mt-2 text-sm font-semibold text-foreground">No Opportunities Found</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search query.</p>
                    </EmptyState>
                </div>
            );
        }

        return (
            <ul>
                {projects.map((project, index) => (
                    <li key={project['Pipeline No.']}>
                        <button
                            onClick={() => onSelectProject(project['Pipeline No.'])}
                            className={`w-full text-left px-4 py-3.5 border-b border-border border-l-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 z-10 relative animate-in fade-in slide-in-from-left-2 duration-300 fill-mode-backwards ${selectedPipelineNo === project['Pipeline No.']
                                ? 'bg-brand-500/10 border-brand-500'
                                : 'border-transparent hover:bg-muted'
                                }`}
                            style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <h3 className={`truncate text-base ${selectedPipelineNo === project['Pipeline No.']
                                        ? 'font-bold text-brand-500'
                                        : 'font-semibold text-foreground'
                                        }`}>
                                        {project['Company Name']}
                                    </h3>
                                    <p className="text-sm text-muted-foreground truncate mt-0.5 font-mono">{project['Pipeline No.']}</p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                    <p className={`text-sm font-semibold ${selectedPipelineNo === project['Pipeline No.'] ? 'text-brand-500' : 'text-foreground'
                                        }`}>
                                        {formatCurrencySmartly(project['Bid Value'], project.Currency)}
                                    </p>
                                </div>
                            </div>
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

export default PipelineListContainer;

