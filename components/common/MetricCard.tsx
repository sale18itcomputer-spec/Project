'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  change: string;
  changeType: 'increase' | 'decrease';
  onClick?: () => void;
  icon?: React.ReactElement<{ className?: string }>;
  className?: string;
  isCompact?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subValue, onClick, className, isCompact = false, icon }) => {
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
        <div className="text-2xl font-bold text-foreground transition-transform duration-200 group-hover:translate-x-0.5">{value}</div>
        {subValue && <div className="text-base font-semibold text-muted-foreground -mt-1">{subValue}</div>}
      </CardContent>
    </Card>
  );

  return onClick ? <button onClick={onClick} className="w-full text-left">{cardElement}</button> : cardElement;
};

export default React.memo(MetricCard);
