import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { PricelistItem } from "../../types";
import { Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from "../ui/button";
import { parseSheetValue } from "../../utils/formatters";

// --- Environment Variable Note ---
// The Google Gemini API Key is securely managed as an environment variable (`process.env.API_KEY`).
// It is NOT hardcoded in the application. You can assume this is configured in the deployment environment.
// ---

interface GeminiPricelistInsightsProps {
    items: PricelistItem[];
}

// A simple component to render markdown-like text with Tailwind Prose
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => (
    <div
        className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-slate-800 prose-h3:text-base prose-p:text-slate-700 prose-ul:text-slate-700 prose-li:my-1"
        dangerouslySetInnerHTML={{
            __html: content
                .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-slate-800 mb-2 mt-4">$1</h3>')
                .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-700">$1</li>')
                .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc text-slate-700">$1</li>')
                .replace(/\n/g, '<br />')
                .replace(/<br \s*\/?>(\s*<li)/g, '$1') // Clean up breaks before list items
        }}
    />
);

const GeminiPricelistInsights: React.FC<GeminiPricelistInsightsProps> = ({ items }) => {
    const [insights, setInsights] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const summarizedData = useMemo(() => {
        const sampleSize = 50;
        const sampledItems = items.length > sampleSize ? items.slice(0, sampleSize) : items;

        return sampledItems.map(item => ({
            Brand: item.Brand,
            Model: item.Model,
            Category: item.Category,
            Price: parseSheetValue(item['End User Price']),
            Status: item.Status,
        }));
    }, [items]);

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
You are an expert inventory and product analyst for Limperial, a technology solutions company. Your task is to analyze the following pricelist data and provide actionable insights for the sales and procurement teams.

Here is a sample of the current pricelist data being viewed (${items.length} total items):

${JSON.stringify(summarizedData, null, 2)}

Based on this data, please provide a concise report in Markdown format with the following sections:

### Availability Status
- Analyze the "Status" field to identify how many products are "Available", "Out of Stock", or "Pre-Order".
- Highlight any major availability concerns for key models or brands.

### Pricing & Product Observations
- Point out the top 3 most expensive items in this list.
- Briefly mention the most common brands or categories in this data view.

### Recommendations
- Suggest 1-2 actionable steps based on availability status and pricing (e.g. promoting available items, restocking out-of-stock items if applicable).

Keep your analysis brief, insightful, and focused on business impact. Avoid mentioning that you are an AI.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
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
                        Pricelist AI Insights
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Let Gemini analyze the current pricelist to find trends and inventory insights.
                    </p>
                </div>
                <Button onClick={generateInsights} disabled={isLoading || items.length === 0} className="w-full sm:w-auto">
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
                    <p className="text-slate-600 font-medium mt-4">Gemini is analyzing your pricelist...</p>
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

export default GeminiPricelistInsights;