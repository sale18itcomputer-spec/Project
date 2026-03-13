'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Settings2 } from 'lucide-react';

interface CostColumn {
    id: string;
    name: string;
    sign: -1 | 1;
}

interface RowData {
    id: string;
    cogs: number;
    customCosts: Record<string, number>;
    markUp: number;
    quantity: number;
}

interface MarginGuideline {
    id: string;
    minCogs: number;
    maxCogs: number | null;
    margin: number;
}

export default function PricingCalculatorPage() {
    const [commission, setCommission] = useState<number>(30);
    const [incomeTaxPercent, setIncomeTaxPercent] = useState<number>(20);
    const [operationPercent, setOperationPercent] = useState<number>(50);

    const [marginGuidelines, setMarginGuidelines] = useState<MarginGuideline[]>([
        { id: '1', minCogs: 50, maxCogs: 100, margin: 25 },
        { id: '2', minCogs: 101, maxCogs: 200, margin: 20 },
        { id: '3', minCogs: 201, maxCogs: 300, margin: 10 },
        { id: '4', minCogs: 301, maxCogs: 400, margin: 7 },
        { id: '5', minCogs: 401, maxCogs: 500, margin: 7 },
        { id: '6', minCogs: 501, maxCogs: 600, margin: 7 },
        { id: '7', minCogs: 601, maxCogs: 700, margin: 6 },
        { id: '8', minCogs: 701, maxCogs: 800, margin: 5 },
        { id: '9', minCogs: 801, maxCogs: 900, margin: 5 },
        { id: '10', minCogs: 901, maxCogs: 1000, margin: 5 },
        { id: '11', minCogs: 1001, maxCogs: 1500, margin: 5 },
        { id: '12', minCogs: 1501, maxCogs: 2000, margin: 5 },
        { id: '13', minCogs: 2001, maxCogs: null, margin: 5 },
    ]);

    const [costColumns, setCostColumns] = useState<CostColumn[]>([
        { id: 'freebies', name: 'Freebies', sign: -1 },
        { id: 'rebate', name: 'Rebate', sign: -1 }
    ]);

    const [rows, setRows] = useState<RowData[]>([
        {
            id: "1",
            cogs: 360,
            customCosts: {
                'freebies': 0,
                'rebate': 0
            },
            markUp: 7,
            quantity: 1,
        }
    ]);

    const addRow = () => {
        const initialCustomCosts: Record<string, number> = {};
        costColumns.forEach(c => initialCustomCosts[c.id] = 0);
        setRows([
            ...rows,
            {
                id: Math.random().toString(36).substring(7),
                cogs: 0,
                customCosts: initialCustomCosts,
                markUp: 0,
                quantity: 1,
            }
        ]);
    };

    const removeRow = (id: string) => {
        if (rows.length > 1) {
            setRows(rows.filter(r => r.id !== id));
        }
    };

    const updateRow = (id: string, field: keyof RowData, value: number) => {
        setRows(rows.map(r => {
            if (r.id !== id) return r;

            const updatedRow = { ...r, [field]: value };

            if (field === 'cogs') {
                const cogs = value;
                const guideline = marginGuidelines.find(g => cogs >= g.minCogs && (g.maxCogs === null || cogs <= g.maxCogs));
                if (guideline) {
                    updatedRow.markUp = guideline.margin;
                }
            }

            return updatedRow;
        }));
    };

    const updateCostValue = (rowId: string, colId: string, value: number) => {
        setRows(rows.map(r => r.id === rowId ? {
            ...r, customCosts: { ...r.customCosts, [colId]: value }
        } : r));
    };

    const addCostColumn = () => {
        const newId = Math.random().toString(36).substring(7);
        setCostColumns([...costColumns, { id: newId, name: `New Cost`, sign: 1 }]);
        setRows(rows.map(r => ({ ...r, customCosts: { ...r.customCosts, [newId]: 0 } })));
    };

    const removeCostColumn = (colId: string) => {
        setCostColumns(costColumns.filter(c => c.id !== colId));
        // We can optionally leave the unmapped data in customCosts to safely retain memory, but it's fine.
    };

    const renameCostColumn = (colId: string, newName: string) => {
        setCostColumns(costColumns.map(c => c.id === colId ? { ...c, name: newName } : c));
    };

    const toggleColSign = (colId: string) => {
        setCostColumns(costColumns.map(c => c.id === colId ? { ...c, sign: (c.sign === 1 ? -1 : 1) as -1 | 1 } : c));
    };

    const addGuideline = () => {
        setMarginGuidelines([...marginGuidelines, {
            id: Math.random().toString(36).substring(7),
            minCogs: 0,
            maxCogs: null,
            margin: 0
        }]);
    };

    const removeGuideline = (id: string) => {
        setMarginGuidelines(marginGuidelines.filter(g => g.id !== id));
    };

    const updateGuideline = (id: string, field: keyof MarginGuideline, value: number | null) => {
        setMarginGuidelines(marginGuidelines.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    const formatPercent = (val: number) => `${val.toFixed(2)}%`;

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Pricing Calculator</h2>
                    <p className="text-muted-foreground mt-1 text-sm pt-2">
                        Calculate your true profit including commission, operational costs, and taxes.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-primary/5 border-primary/20 shadow-sm shadow-primary/10 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Global Commission ($)
                        </CardTitle>
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            <span className="text-lg text-muted-foreground">$</span>
                            <Input
                                type="number"
                                value={commission}
                                onChange={(e) => setCommission(Number(e.target.value))}
                                className="font-bold text-lg bg-background"
                                step="0.01"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Fixed amount added to selling price
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20 shadow-sm shadow-primary/10 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Income Tax (%)
                        </CardTitle>
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            <Input
                                type="number"
                                value={incomeTaxPercent}
                                onChange={(e) => setIncomeTaxPercent(Number(e.target.value))}
                                className="font-bold text-lg bg-background"
                                step="0.1"
                            />
                            <span className="text-lg text-muted-foreground">%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Percentage of profit after operation
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20 shadow-sm shadow-primary/10 transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Operation Cost (%)
                        </CardTitle>
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            <Input
                                type="number"
                                value={operationPercent}
                                onChange={(e) => setOperationPercent(Number(e.target.value))}
                                className="font-bold text-lg bg-background"
                                step="0.1"
                            />
                            <span className="text-lg text-muted-foreground">%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Percentage of gross margin
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="mt-6 border-slate-200/60 shadow-md">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Calculation Table</CardTitle>
                        <CardDescription>Enter product costs and target markup to see profit breakdowns.</CardDescription>
                    </div>
                    <Button onClick={addRow} variant="default" size="sm" className="h-9 gap-1.5 shadow-sm">
                        <Plus className="h-4 w-4" />
                        Add Row
                    </Button>
                </CardHeader>
                <CardContent className="pt-4 overflow-x-auto">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="min-w-[120px] font-semibold text-primary">COGS</TableHead>
                                    <TableHead className="w-[80px] font-semibold text-primary">QTY</TableHead>
                                    {costColumns.map((col) => (
                                        <TableHead key={col.id} className="min-w-[140px] px-2 py-3">
                                            <div className="flex items-center gap-1 group bg-background rounded-md border border-transparent hover:border-border focus-within:border-input px-1.5 py-1 transition-all shadow-sm">
                                                <button
                                                    onClick={() => toggleColSign(col.id)}
                                                    className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded text-xs font-bold transition-colors ${col.sign === 1 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
                                                    title={col.sign === 1 ? "Adds to COGS" : "Subtracts from COGS"}
                                                >
                                                    {col.sign === 1 ? '+' : '−'}
                                                </button>
                                                <Input
                                                    value={col.name}
                                                    onChange={(e) => renameCostColumn(col.id, e.target.value)}
                                                    className="h-6 px-1.5 py-0 text-xs font-medium border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent min-w-[70px]"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeCostColumn(col.id)}
                                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-red-600 transition-opacity flex-shrink-0 ml-auto"
                                                    title="Remove Column"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableHead>
                                    ))}

                                    <TableHead className="w-[50px] px-2">
                                        <Button
                                            onClick={addCostColumn}
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-primary shadow-sm border border-primary/20 bg-primary/5 hover:bg-primary/10"
                                            title="Add Cost Modifier Column"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </TableHead>

                                    <TableHead className="min-w-[120px] font-semibold text-slate-700 bg-slate-50 border-l">Avg Cost</TableHead>
                                    <TableHead className="min-w-[100px] text-primary">Mark Up (%)</TableHead>
                                    <TableHead className="min-w-[120px] font-semibold text-slate-800 bg-slate-50 border-l">Selling PR</TableHead>
                                    <TableHead className="min-w-[120px] border-l bg-brand-50/30">Commission ({formatCurrency(commission)})</TableHead>
                                    <TableHead className="min-w-[120px] font-semibold border-l">Margin</TableHead>
                                    <TableHead className="min-w-[110px]">Operation ({operationPercent}%)</TableHead>
                                    <TableHead className="min-w-[120px] font-semibold">Profit</TableHead>
                                    <TableHead className="min-w-[110px]">Income Tax ({incomeTaxPercent}%)</TableHead>
                                    <TableHead className="min-w-[120px] font-bold text-green-600 border-l bg-green-50/50">True Profit</TableHead>
                                    <TableHead className="min-w-[100px] font-bold text-green-600 bg-green-50/50">True Profit %</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => {
                                    // Calculate Custom Costs
                                    const customCostsTotal = costColumns.reduce((sum, col) => {
                                        return sum + ((row.customCosts[col.id] || 0) * col.sign);
                                    }, 0);

                                    const avgCost = row.cogs + customCostsTotal;
                                    const sellingPR = avgCost * (1 + row.markUp / 100);
                                    const priceWithComm = sellingPR + commission;

                                    // Total calculations taking quantity into account
                                    const totalMargin = (sellingPR - avgCost) * row.quantity;
                                    const operationVal = totalMargin * (operationPercent / 100);
                                    const profit = totalMargin - operationVal;
                                    const incomeTaxVal = profit * (incomeTaxPercent / 100);
                                    const trueProfit = profit - incomeTaxVal;

                                    const totalCost = avgCost * row.quantity;
                                    const trueProfitPercent = totalCost > 0 ? (trueProfit / totalCost) * 100 : 0;


                                    return (
                                        <TableRow key={row.id} className="group hover:bg-muted/30 transition-colors">
                                            <TableCell className="p-2">
                                                <Input
                                                    type="number"
                                                    value={row.cogs}
                                                    onChange={(e) => updateRow(row.id, 'cogs', Number(e.target.value))}
                                                    className="h-8 shadow-sm border-slate-200 focus-visible:ring-primary/20 font-medium"
                                                    step="0.01"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    type="number"
                                                    value={row.quantity}
                                                    onChange={(e) => updateRow(row.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="h-8 shadow-sm border-slate-200 focus-visible:ring-primary/20 font-medium text-center"
                                                    min="1"
                                                />
                                            </TableCell>
                                            {costColumns.map((col) => (
                                                <TableCell key={col.id} className="p-2">
                                                    <Input
                                                        type="number"
                                                        value={row.customCosts[col.id] || 0}
                                                        onChange={(e) => updateCostValue(row.id, col.id, Number(e.target.value))}
                                                        className={`h-8 shadow-sm border-slate-200 focus-visible:ring-primary/20 ${col.sign === 1 ? 'text-blue-700' : 'text-rose-700'}`}
                                                        step="0.01"
                                                    />
                                                </TableCell>
                                            ))}
                                            <TableCell className="p-2"></TableCell>

                                            <TableCell className="p-2 font-semibold text-slate-700 bg-slate-50/50 border-l">
                                                {formatCurrency(avgCost)}
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    type="number"
                                                    value={row.markUp}
                                                    onChange={(e) => updateRow(row.id, 'markUp', Number(e.target.value))}
                                                    className="h-8 shadow-sm border-slate-200 focus-visible:ring-primary/20"
                                                    step="0.1"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2 bg-slate-50/50 border-l">
                                                <Input
                                                    type="number"
                                                    value={Number(sellingPR.toFixed(2))}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        if (avgCost > 0) {
                                                            const newMarkUp = ((val / avgCost) - 1) * 100;
                                                            updateRow(row.id, 'markUp', Number(newMarkUp.toFixed(4)));
                                                        }
                                                    }}
                                                    className="h-8 shadow-sm border-slate-300 focus-visible:border-primary focus-visible:ring-primary/20 font-bold text-slate-800 bg-white"
                                                    step="0.01"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2 font-medium border-l bg-brand-50/10 whitespace-nowrap">
                                                {formatCurrency(priceWithComm)}
                                            </TableCell>
                                            <TableCell className="p-2 font-medium border-l">
                                                <span className={totalMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                    {formatCurrency(totalMargin)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="p-2 text-slate-600 text-sm">
                                                {formatCurrency(operationVal)}
                                            </TableCell>
                                            <TableCell className="p-2 font-medium">
                                                <span className={profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                    {formatCurrency(profit)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="p-2 text-slate-600 text-sm">
                                                {formatCurrency(incomeTaxVal)}
                                            </TableCell>
                                            <TableCell className="p-2 font-bold border-l bg-green-50/20 whitespace-nowrap">
                                                <span className={trueProfit >= 0 ? 'text-green-600' : 'text-red-500'}>
                                                    {formatCurrency(trueProfit)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="p-2 font-bold bg-green-50/20">
                                                <span className={trueProfitPercent >= 0 ? 'text-green-600' : 'text-red-500'}>
                                                    {formatPercent(trueProfitPercent)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="p-2 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeRow(row.id)}
                                                    disabled={rows.length === 1}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card className="mt-6 border-slate-200/60 shadow-md xl:w-1/2">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Purchase Price & Margin Table</CardTitle>
                        <CardDescription>
                            General guide for recommended margins based on COGS.
                        </CardDescription>
                    </div>
                    <Button onClick={addGuideline} variant="outline" size="sm" className="h-8 gap-1 shadow-sm">
                        <Plus className="h-3 w-3" />
                        Add Rule
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-primary text-center">Min COGS ($)</TableHead>
                                    <TableHead className="font-semibold text-primary text-center">Max COGS ($)</TableHead>
                                    <TableHead className="font-semibold text-primary text-center">Margin (%)</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {marginGuidelines.map((row) => (
                                    <TableRow key={row.id} className="group hover:bg-muted/30">
                                        <TableCell className="p-2 border-r">
                                            <Input
                                                type="number"
                                                value={row.minCogs}
                                                onChange={(e) => updateGuideline(row.id, 'minCogs', Number(e.target.value))}
                                                className="h-8 shadow-sm border-transparent hover:border-border focus-visible:border-primary text-center"
                                                step="0.01"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 border-r">
                                            <Input
                                                type="number"
                                                placeholder="No limit"
                                                value={row.maxCogs === null ? '' : row.maxCogs}
                                                onChange={(e) => updateGuideline(row.id, 'maxCogs', e.target.value === '' ? null : Number(e.target.value))}
                                                className="h-8 shadow-sm border-transparent hover:border-border focus-visible:border-primary text-center"
                                                step="0.01"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <div className="flex items-center justify-center gap-1 font-semibold">
                                                <Input
                                                    type="number"
                                                    value={row.margin}
                                                    onChange={(e) => updateGuideline(row.id, 'margin', Number(e.target.value))}
                                                    className="h-8 shadow-sm border-transparent hover:border-border focus-visible:border-primary font-bold text-center"
                                                    step="0.01"
                                                />
                                                <span className="text-muted-foreground text-sm font-medium">%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-2 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeGuideline(row.id)}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/20 opacity-40 hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4 italic">
                        *Note: This table serves as a general guide. Final margins may vary and are not strictly limited to these figures.
                        Leave &quot;Max COGS ($)&quot; blank for no upper limit.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
