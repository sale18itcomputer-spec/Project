'use client';

import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ProjectStatusData } from "../../types";
import { Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from "../ui/button";

// --- Environment Variable Note ---
// The Google Gemini API Key is securely managed as an environment variable (`process.env.API_KEY`).
// It is NOT hardcoded in the application. You can assume this is configured in the deployment environment.
// ---

// Props matching the data available in Dashboard.tsx
interface GeminiDashboardInsightsProps {
    projectOutcomeData: ProjectStatusData[];
    revenueByPeriodData: { chartData: { name: string; winValue: number }[] };
    topCustomersData: { name: string; winValue: number }[];
    winRateData: { winRate: number; won: number; total: number };
    filteredProjectsCount: number;
    revenuePeriod: 'monthly' | 'quarterly' | 'yearly';
}

// A simple component to render markdown-like text with Tailwind Prose
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => (
    <div
        className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-slate-800 prose-h3:text-base prose-p:text-slate-700 prose-ul:text-slate-700 prose-li:my-1"
        dangerouslySetInnerHTML={{ __html: content
            .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-slate-800 mb-2 mt-4">$1</h3>')
            .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-700">$1</li>')
            .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc text-slate-700">$1</li>')
            .replace(/\n/g, '<br />')
            .replace(/<br \s*\/?>(\s*<li)/g, '$1') // Clean up breaks before list items
        }}
    />
);

const GeminiDashboardInsights: React.FC<GeminiDashboardInsightsProps> = ({
    projectOutcomeData,
    revenueByPeriodData,
    topCustomersData,
    winRateData,
    filteredProjectsCount,
    revenuePeriod,
}) => {
    const [insights, setInsights] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateInsights = async () => {
        setIsLoading(true);
        setError(null);
        setInsights(null);

        try {
            if (!process.env.API_KEY) {
                throw new Error("API key is not configured.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const prompt = `
You are a senior business analyst for a technology solutions company called Limperial. Your task is to analyze the following sales dashboard data and provide actionable insights for the management team.

Here is the data for the current filtered view:

- Total pipelines being viewed: ${filteredProjectsCount}
- Pipeline Outcomes (Win/Loss/Pending): ${JSON.stringify(projectOutcomeData, null, 2)}
- Revenue from Won Projects (by ${revenuePeriod}): ${JSON.stringify(revenueByPeriodData.chartData, null, 2)}
- Top 10 Customers by Revenue: ${JSON.stringify(topCustomersData, null, 2)}
- Overall Win Rate Data (won projects out of total closed projects): ${JSON.stringify(winRateData, null, 2)}

Based on this data, please provide a concise report in Markdown format with the following sections:

### Key Observations
- Highlight 2-3 of the most important trends or standout figures from the data.

### Potential Opportunities
- Identify potential areas for growth. Which customers are most valuable? Are there trends in won projects we can capitalize on?

### Identified Risks
- Point out any potential risks. Is the win rate low? Is revenue concentrated in too few customers? Are there many projects stuck in the 'Quote Submitted' stage?

### Recommendations
- Suggest 1-2 concrete, actionable steps the sales team or management could take based on your analysis.

Keep your analysis brief, insightful, and focused on business impact. Avoid mentioning that you are an AI.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });
            
            setInsights(response.text);

        } catch (err: any) {
            console.error("Error generating insights:", err);
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-brand-600" />
                        Dashboard AI Insights
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Let Gemini analyze the current data view to find trends and opportunities.
                    </p>
                </div>
                <Button onClick={generateInsights} disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                            Analyzing...
                        </>
                    ) : (
                         <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Insights
                        </>
                    )}
                </Button>
            </div>

            {error && (
                <div className="mt-4 bg-rose-50 border-l-4 border-rose-400 text-rose-800 p-4 rounded-md text-sm" role="alert">
                    <p className="font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Error Generating Insights</p>
                    <p className="mt-2">{error}</p>
                </div>
            )}
            
            {isLoading && !insights && (
                 <div className="mt-4 text-center py-8">
                     <div className="flex justify-center items-center">
                        <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />
                     </div>
                     <p className="text-slate-600 font-medium mt-4">Gemini is analyzing your data...</p>
                 </div>
            )}

            {insights && (
                <div className="mt-6 pt-6 border-t border-slate-200 animate-fadeIn">
                    <MarkdownRenderer content={insights} />
                </div>
            )}
        </div>
    );
};

export default GeminiDashboardInsights;
