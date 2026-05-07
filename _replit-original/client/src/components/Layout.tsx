import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Trophy, Users, Flag, BarChart3, ArrowLeft, LogIn, LogOut, Shield, Sailboat} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backTo?: string;
}

export function Layout({ children, title, showBack, backTo }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="bg-[hsl(var(--primary))] text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {showBack && (
            <Link href={backTo || '/'}>
              <button className="p-1 rounded-full hover:bg-white/20 transition-colors">
                <ArrowLeft size={20} />
              </button>
            </Link>
          )}

          {/* Logo */}
          <img
            src="/logo.png"
            alt="Bayfield Open"
            className="h-11 w-11 object-contain flex-shrink-0"
            style={{ filter: 'invert(1)' }}
          />

          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-green-200 font-medium">The Bayfield Open</div>
            {title && <h1 className="text-lg font-bold truncate" style={{ fontFamily: 'Playfair Display, serif' }}>{title}</h1>}
          </div>

          {/* Auth button */}
          {user ? (
            <button
              onClick={logout}
              title="Log out"
              className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex-shrink-0 max-w-[140px]"
            >
              {isAdmin
                ? <Shield size={13} className="text-yellow-300 flex-shrink-0" />
                : <LogOut size={13} className="flex-shrink-0" />}
              <span className="text-xs text-white font-semibold truncate leading-none">
                {user.name.split(' ')[0]}
              </span>
            </button>
          ) : (
            <Link href="/login">
              <button
                title="Log in"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-sm font-semibold flex-shrink-0"
              >
                <LogIn size={15} />
                <span>Login</span>
              </button>
            </Link>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[hsl(var(--border))] z-50">
        <div className="max-w-lg mx-auto flex">
          <NavItem href="/" icon={<Sailboat size={20} />} label="Home" active={location === '/'} />
          <NavItem href="/day1/leaderboard" icon={<Flag size={20} />} label="Day 1" active={location.startsWith('/day1')} />
          <NavItem href="/day2/leaderboard" icon={<Users size={20} />} label="Day 2" active={location.startsWith('/day2')} />
          <NavItem href="/day3/leaderboard" icon={<Trophy size={20} />} label="Day 3" active={location.startsWith('/day3')} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex-1">
      <button className={cn(
        "w-full flex flex-col items-center gap-0.5 py-2 px-1 text-xs font-medium transition-colors",
        active
          ? "text-[hsl(var(--primary))]"
          : "text-[hsl(var(--muted-foreground))]"
      )}>
        {icon}
        <span>{label}</span>
      </button>
    </Link>
  );
}
