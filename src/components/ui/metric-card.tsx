import { Card, CardContent, CardHeader, CardTitle } from './card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  suffix, 
  description, 
  variant = 'default',
  icon,
  className 
}: MetricCardProps) {
  const variantClasses = {
    default: 'border-card-border',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    error: 'border-destructive/30 bg-destructive/5'
  };

  const valueClasses = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-destructive'
  };

  return (
    <Card className={cn('gradient-card border', variantClasses[variant], className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold font-mono', valueClasses[variant])}>
          {value}
          {suffix && <span className="text-sm ml-1">{suffix}</span>}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}