import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';

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
      "transition-all duration-300 transform",
      onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-px' : '',
      className
    ),
    ...(onClick && { onClick }),
  };

  const cardElement = (
    <Card {...cardProps}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {isCompact && icon && React.cloneElement(icon, { className: 'h-4 w-4 text-muted-foreground' })}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subValue && <div className="text-base font-semibold text-slate-600 -mt-1">{subValue}</div>}
      </CardContent>
    </Card>
  );

  return onClick ? <button onClick={onClick} className="w-full text-left">{cardElement}</button> : cardElement;
};

export default React.memo(MetricCard);