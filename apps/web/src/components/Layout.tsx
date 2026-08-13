import { Link, useLocation } from 'react-router-dom';
import { Cloud, LayoutGrid, BarChart3, Shield, Globe, Map, Server, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Home', icon: Cloud },
  { path: '/marketplace', label: 'Marketplace', icon: LayoutGrid },
  { path: '/availability-zones', label: 'Regions', icon: Globe },
  { path: '/roadmap', label: 'Roadmap', icon: Map },
  { path: '/instances', label: 'Instances', icon: Server },
  { path: '/forecasts', label: 'Forecasts', icon: BarChart3 },
  { path: '/admin', label: 'Admin', icon: Shield },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Navbar */}
      <nav
        className={cn(
          'sticky top-0 z-50 border-b transition-all duration-200',
          scrolled
            ? 'border-slate-800 bg-slate-950/95 backdrop-blur-md shadow-sm shadow-black/20'
            : 'border-transparent bg-slate-950/80 backdrop-blur-sm'
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-blue-400 hover:text-blue-300 transition-colors">
            <Cloud className="h-6 w-6" />
            <span>CloudMarket</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden rounded-md p-2.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-200 md:hidden',
            mobileOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                    active
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 mt-auto">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          <p>CloudMarket IaaS — Cloud infrastructure marketplace</p>
          <p className="mt-1 text-xs text-slate-600">
            React 18 + TypeScript + Tailwind CSS + shadcn/ui
          </p>
        </div>
      </footer>
    </div>
  );
}
