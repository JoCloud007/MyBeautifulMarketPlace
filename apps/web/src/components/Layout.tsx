import { Link, useLocation } from 'react-router-dom';
import {
  Cloud, LayoutGrid, BarChart3, Shield, Globe, Map, Server,
  Wrench, ShieldCheck, Layers, Menu, X,
  ChevronDown, Home,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/* ── Nav structure ─────────────────────────────────────────────── */

const navGroups = [
  {
    label: 'Catalog',
    icon: LayoutGrid,
    items: [
      { path: '/marketplace', label: 'Marketplace', icon: LayoutGrid },
      { path: '/availability-zones', label: 'Regions', icon: Globe },
      { path: '/roadmap', label: 'Roadmap', icon: Map },
    ],
  },
  {
    label: 'Operations',
    icon: Server,
    items: [
      { path: '/maintenance', label: 'Maintenance', icon: Wrench },
    ],
  },
  {
    label: 'Resilience',
    icon: ShieldCheck,
    items: [
      { path: '/continuity', label: 'Continuity', icon: ShieldCheck },
    ],
  },
  {
    label: 'Planning',
    icon: BarChart3,
    items: [
      { path: '/forecasts', label: 'Forecasts', icon: BarChart3 },
      { path: '/applications', label: 'Applications', icon: Layers },
    ],
  },
];

const standalone = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/admin', label: 'Admin', icon: Shield },
];

/* ── Helpers ───────────────────────────────────────────────────── */

function useClickOutside(ref: React.RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    const cb = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    };
    document.addEventListener('mousedown', cb);
    return () => document.removeEventListener('mousedown', cb);
  }, [ref, handler]);
}

function isGroupActive(items: { path: string }[], pathname: string) {
  return items.some((i) => pathname === i.path || pathname.startsWith(i.path + '/'));
}

/* ── Component ─────────────────────────────────────────────────── */

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setOpenGroup(null));

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-blue-400 hover:text-blue-300 transition-colors shrink-0">
            <Cloud className="h-5 w-5" />
            <span className="hidden sm:inline">CloudMarket</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex md:items-center md:gap-0.5" ref={dropdownRef}>
            {/* Standalone items */}
            {standalone.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}

            <div className="mx-1 h-5 w-px bg-slate-800" />

            {/* Dropdown groups */}
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const active = isGroupActive(group.items, location.pathname);
              const isOpen = openGroup === group.label;

              return (
                <div key={group.label} className="relative">
                  <button
                    onClick={() => setOpenGroup(isOpen ? null : group.label)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
                      active
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    )}
                  >
                    <GroupIcon className="h-4 w-4" />
                    <span className="hidden lg:inline">{group.label}</span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
                  </button>

                  {isOpen && (
                    <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-slate-800 bg-slate-900 py-1 shadow-lg shadow-black/30 z-50">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const itemActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setOpenGroup(null)}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                              itemActive
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
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
            mobileOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 space-y-3">
            {/* Standalone */}
            <div className="space-y-1">
              {standalone.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px]',
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

            {/* Groups */}
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.label} className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <GroupIcon className="h-3.5 w-3.5" />
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ml-2',
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
