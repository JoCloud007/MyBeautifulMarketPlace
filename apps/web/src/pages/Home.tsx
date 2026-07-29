import { Link } from 'react-router-dom';
import { ArrowRight, Cloud, Shield, Zap, Server, TrendingUp, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Server,
    title: 'Infrastructure Complète',
    description: 'VMs, bare metal, stockage et virtualisation — tout en un seul catalogue.',
  },
  {
    icon: Zap,
    title: 'Provisionnement Rapide',
    description: 'Déployez vos ressources en quelques clics avec des templates pré-configurés.',
  },
  {
    icon: Shield,
    title: 'Gouvernance Intégrée',
    description: "Workflows d'approbation et traçabilité complète des demandes.",
  },
  {
    icon: Cloud,
    title: 'Multi-Cloud Ready',
    description: 'Compatible avec les principaux hyperviseurs et plateformes cloud.',
  },
];

const stats = [
  { value: '8+', label: 'Produits disponibles', icon: TrendingUp },
  { value: '4', label: 'Catégories', icon: Cloud },
  { value: '4', label: 'Flavors par produit', icon: Zap },
  { value: '24/7', label: 'Disponibilité', icon: Clock },
];

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero */}
      <section className="text-center pt-4 sm:pt-8">
        <div className="animate-fade-in-up">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Votre Marketplace{' '}
            <span className="text-blue-500">IaaS</span>
          </h1>
        </div>
        <div className="animate-fade-in-up stagger-2">
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl">
            Découvrez, provisionnez et gérez vos ressources d'infrastructure cloud
            depuis une interface unique et moderne.
          </p>
        </div>
        <div className="animate-fade-in-up stagger-3 mt-8 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <Link to="/marketplace">
            <Button size="lg" className="gap-2 w-full sm:w-auto min-h-[44px]">
              Explorer le catalogue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/forecasts">
            <Button variant="outline" size="lg" className="w-full sm:w-auto min-h-[44px]">
              Voir les forecasts
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <AnimatedSection>
        <section>
          <h2 className="mb-8 text-center text-2xl font-bold text-white sm:text-3xl">
            Pourquoi CloudMarket ?
          </h2>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="group bg-slate-900 border-slate-800 transition-all duration-300 hover:border-blue-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 transition-colors group-hover:bg-blue-500/20">
                      <Icon className="h-5 w-5 text-blue-500 transition-transform group-hover:scale-110" />
                    </div>
                    <CardTitle className="text-lg text-white mt-3">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-slate-400">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </AnimatedSection>

      {/* Stats teaser */}
      <AnimatedSection delay={100}>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
          <div className="grid gap-6 sm:gap-8 grid-cols-2 lg:grid-cols-4 text-center">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="group">
                  <Icon className="mx-auto h-6 w-6 text-blue-500/60 transition-colors group-hover:text-blue-500" />
                  <div className="mt-2 text-3xl font-bold text-blue-400">{stat.value}</div>
                  <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </section>
      </AnimatedSection>

      {/* CTA Section */}
      <AnimatedSection delay={100}>
        <section className="rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Prêt à déployer votre infrastructure ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Parcourez notre catalogue de produits cloud et soumettez vos demandes de provisionnement en quelques clics.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/marketplace">
              <Button size="lg" className="gap-2 w-full sm:w-auto min-h-[44px]">
                <Cloud className="h-4 w-4" />
                Voir le catalogue
              </Button>
            </Link>
            <Link to="/admin">
              <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto min-h-[44px]">
                <Users className="h-4 w-4" />
                Administration
              </Button>
            </Link>
          </div>
        </section>
      </AnimatedSection>
    </div>
  );
}
