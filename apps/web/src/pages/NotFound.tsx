import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, AlertCircle, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center animate-fade-in-up">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 border border-slate-800 animate-pulse-soft">
        <AlertCircle className="h-10 w-10 text-slate-500" />
      </div>
      <h1 className="mt-6 text-5xl sm:text-6xl font-bold text-white">404</h1>
      <p className="mt-2 text-lg sm:text-xl text-slate-400">Page introuvable</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link to="/">
          <Button className="gap-2 min-h-[44px] w-full sm:w-auto">
            <Home className="h-4 w-4" />
            Retour à l'accueil
          </Button>
        </Link>
        <Link to="/marketplace">
          <Button variant="outline" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 min-h-[44px] w-full sm:w-auto">
            <Search className="h-4 w-4" />
            Explorer le catalogue
          </Button>
        </Link>
      </div>
    </div>
  );
}
