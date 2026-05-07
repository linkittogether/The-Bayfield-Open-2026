import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' };

export function PlayerAvatar({ name, photoUrl, size = 'md', className }: PlayerAvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={cn(
      "rounded-full overflow-hidden flex items-center justify-center bg-[hsl(var(--primary))] text-white font-semibold flex-shrink-0",
      sizes[size], className
    )}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
