'use client';

import React, { useEffect, useRef, useState } from 'react';
import { prepare, layout } from '@chenglou/pretext';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  change?: string;
  changeType?: 'increase' | 'decrease';
  onClick?: () => void;
  icon?: React.ReactElement<{ className?: string }>;
  className?: string;
  isCompact?: boolean;
}

function useAutoFontSize(text: string, font: string, lineHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState<string>('text-2xl');

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.offsetWidth;
    if (width === 0) return;
    const sizes: Array<{ cls: string; px: number }> = [
      { cls: 'text-2xl', px: 24 },
      { cls: 'text-xl',  px: 20 },
      { cls: 'text-lg',  px: 18 },
      { cls: 'text-base', px: 16 },
    ];
    for (const { cls, px } of sizes) {
      const prepared = prepare(text, `bold ${px}px ${font}`);
      const { lineCount } = layout(prepared, width, lineHeight);
      if (lineCount <= 1) { setFontSize(cls); return; }
    }
    setFontSize('text-base');
  }, [text, font, lineHeight]);

  return { containerRef, fontSize };
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subValue, onClick, className, isCompact = false, icon }) => {
  const { containerRef, fontSize } = useAutoFontSize(value, 'Inter', 32);
  const cardProps = {
    className: cn(
      "transition-all duration-300 transform group relative overflow-hidden",
      onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-primary/20' : '',
      className
    ),
    ...(onClick && { onClick }),
  };

  const cardElement = (
    <Card {...cardProps}>
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200">{title}</CardTitle>
        {isCompact && icon && React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { className: 'h-4 w-4 text-muted-foreground group-hover:text-primary/70 transition-colors duration-200' })}
      </CardHeader>
      <CardContent className="relative z-10">
        <div ref={containerRef} className={`${fontSize} font-bold text-foreground transition-transform duration-200 group-hover:translate-x-0.5`}>{value}</div>
        {subValue && <div className="text-base font-semibold text-muted-foreground -mt-1">{subValue}</div>}
      </CardContent>
    </Card>
  );

  return onClick ? <button onClick={onClick} className="w-full text-left">{cardElement}</button> : cardElement;
};

export default React.memo(MetricCard);
