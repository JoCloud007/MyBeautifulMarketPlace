import { useState, useRef, useEffect } from 'react';
import { UserCircle, ChevronDown, Users } from 'lucide-react';
import { useUsers } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { Role } from '@cloudmarket/shared-types';
import { cn } from '@/lib/utils';

/**
 * Simulated-identity switcher: pick a seeded user (or go ad-hoc).
 * Drives the role-based forecast queues and lifecycle actions.
 */
export function UserSwitcher() {
  const { data: users } = useUsers();
  const { user, setUser, activeRole, setActiveRole } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pickUser = (u: { id: string; name: string; email: string; roles: Role[]; managerId: string | null }) => {
    setUser({ id: u.id, name: u.name, email: u.email, roles: u.roles || [], managerId: u.managerId ?? null });
    setOpen(false);
  };

  const submitAdHoc = () => {
    if (!name.trim() || !email.trim()) return;
    setUser({ id: '', name: name.trim(), email: email.trim(), roles: [Role.REQUESTER], managerId: null });
    setAdHocOpen(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
      >
        <UserCircle className="h-4 w-4" />
        <span className="hidden lg:inline max-w-[140px] truncate">{user ? user.name : 'Choose identity'}</span>
        {activeRole && (
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
            {activeRole.replace('_', ' ')}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
          {adHocOpen ? (
            <div className="space-y-2 p-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                type="email"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
              <div className="flex gap-2">
                <button onClick={() => setAdHocOpen(false)} className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700">
                  Back
                </button>
                <button onClick={submitAdHoc} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <p className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">Simulated identity</p>
              {(users || []).map((u) => (
                <button
                  key={u.id}
                  onClick={() => pickUser(u as any)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-800 transition-colors',
                    user?.id === u.id && 'bg-slate-800'
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-slate-200">{u.name}</span>
                    <span className="block truncate text-xs text-slate-500">{u.email}</span>
                  </span>
                  <span className="ml-2 flex shrink-0 gap-1">
                    {(u.roles || []).slice(0, 2).map((r) => (
                      <span key={r} className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300">
                        {r.replace('_', ' ')}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
              <div className="my-1 h-px bg-slate-800" />
              <button
                onClick={() => setAdHocOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Users className="h-4 w-4" />
                Ad-hoc identity (name + email)
              </button>
            </div>
          )}
          {user && user.roles.length > 1 && (
            <>
              <div className="my-1 h-px bg-slate-800" />
              <p className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">Active role</p>
              <div className="flex flex-wrap gap-1 px-2 pb-1">
                {user.roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => setActiveRole(r)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs transition-colors',
                      activeRole === r ? 'bg-blue-500/30 text-blue-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    )}
                  >
                    {r.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
