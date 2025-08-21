import { cn } from '@/lib/utils';
import { Badge } from './badge';

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'host' | 'live' | 'syncing';
  className?: string;
  children?: React.ReactNode;
}

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const statusConfig = {
    online: {
      className: 'bg-success/20 text-success border-success/30',
      dot: 'bg-success'
    },
    offline: {
      className: 'bg-muted/20 text-muted-foreground border-muted/30',
      dot: 'bg-muted-foreground'
    },
    host: {
      className: 'gradient-accent text-accent-foreground border-accent/30 glow-accent',
      dot: 'bg-accent-foreground'
    },
    live: {
      className: 'bg-destructive/20 text-destructive border-destructive/30 animate-pulse',
      dot: 'bg-destructive animate-pulse'
    },
    syncing: {
      className: 'gradient-primary text-primary-foreground border-primary/30',
      dot: 'bg-primary-foreground animate-pulse'
    }
  };

  const config = statusConfig[status];

  return (
    <Badge className={cn(config.className, 'gap-1.5', className)}>
      <div className={cn('w-2 h-2 rounded-full', config.dot)} />
      {children || status}
    </Badge>
  );
}