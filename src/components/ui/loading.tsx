import { cn } from '@/lib/utils';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'accent' | 'muted';
  className?: string;
}

export function Loading({ size = 'md', variant = 'primary', className }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const variantClasses = {
    primary: 'border-primary border-t-transparent',
    accent: 'border-accent border-t-transparent',
    muted: 'border-muted-foreground border-t-transparent'
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    />
  );
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loading size="lg" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}