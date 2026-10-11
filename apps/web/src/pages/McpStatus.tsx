import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Boxes,
  CheckCircle2,
  Copy,
  Database,
  Plug,
  ShieldAlert,
  Terminal,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

interface McpTool {
  name: string;
  description: string;
}

interface McpStatusGroup {
  name: string;
  description: string;
  toolCount: number;
  tools: McpTool[];
}

interface McpStatus {
  server: { name: string; version: string };
  enabled: boolean;
  authRequired: boolean;
  sseEnabled: boolean;
  transport: string;
  endpoint: string;
  toolCount: number;
  groups: McpStatusGroup[];
}

async function fetchMcpStatus(): Promise<McpStatus> {
  const res = await fetch(`${API_URL}/api/mcp-status`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function CopyButton({ text }: { text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard unavailable (permissions, http context) — silent no-op;
      // the snippet stays selectable so the user can copy manually.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
      aria-label="Copy snippet"
    >
      <Copy className="h-3 w-3" />
      Copier
    </button>
  );
}

function CodeBlock({ code, title }: { code: string; title: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const groupColors: Record<string, string> = {
  catalog: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  infrastructure: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  operations: 'bg-green-500/10 text-green-400 border-green-500/20',
  planning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  admin: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export default function McpStatusPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mcp-status'],
    queryFn: fetchMcpStatus,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-8 w-72 animate-pulse rounded bg-slate-800" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-slate-900" />
        <div className="mt-4 h-64 animate-pulse rounded-xl bg-slate-900" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <XCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-slate-300">
              Impossible de récupérer l'état du MCP (API injoignable sur {API_URL || 'l\'origine courante'}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const apiBaseUrl = API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const endpointUrl = `${apiBaseUrl}${data.endpoint}`;
  const authHint = data.authRequired
    ? 'MCP_API_KEY est configurée : chaque requête doit porter "Authorization: Bearer <MCP_API_KEY>" (valeur jamais affichée ici).'
    : 'Aucune authentification : MCP_API_KEY n\'est pas configurée, l\'endpoint accepte les requêtes sans jeton. Pour activer le Bearer, définissez MCP_API_KEY dans .env puis redémarrez l\'API.';

  const authHeaders = data.authRequired ? { Authorization: 'Bearer <MCP_API_KEY>' } : undefined;

  const mcpJson = JSON.stringify(
    {
      mcpServers: {
        cloudmarket: {
          type: 'http',
          url: endpointUrl,
          ...(authHeaders ? { headers: authHeaders } : {}),
        },
      },
    },
    null,
    2,
  );

  const curlSnippet = `curl -X POST ${endpointUrl} \\
${data.authRequired ? `  -H "Authorization: Bearer $MCP_API_KEY" \\\n` : ''}  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

  const tidetSnippet = JSON.stringify(
    {
      name: 'cloudmarket',
      transport: 'http',
      url: endpointUrl,
      ...(authHeaders ? { headers: authHeaders } : {}),
    },
    null,
    2,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">MCP — Model Context Protocol</h1>
          <p className="mt-1 text-sm text-slate-400">
            Pilotage de CloudMarket par API — état du serveur et connexion des clients.
          </p>
        </div>
        <Badge variant="outline" className="border-slate-700 text-slate-300">
          {data.server.name} v{data.server.version}
        </Badge>
      </div>

      {/* Status card */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-blue-400" />
            État de l'endpoint
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-2">
              {data.enabled ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`text-sm font-semibold ${data.enabled ? 'text-green-400' : 'text-red-400'}`}>
                {data.enabled ? 'Endpoint actif' : 'Endpoint désactivé (fail-closed)'}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Transport</p>
              <p className="flex items-center gap-1 text-sm font-medium text-slate-200">
                <Plug className="h-3.5 w-3.5 text-slate-400" />
                Streamable HTTP (stateless)
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Fallback SSE</p>
              <p className="text-sm font-medium text-slate-200">
                {data.sseEnabled ? 'Activé (/sse)' : 'Désactivé'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">URL</p>
              <code className="text-sm text-blue-300">{endpointUrl}</code>
            </div>
            <div className="ml-auto">
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20" variant="outline">
                {data.toolCount} tools exposés
              </Badge>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <ShieldAlert
              className={`mt-0.5 h-4 w-4 shrink-0 ${data.authRequired ? 'text-yellow-500' : 'text-green-500'}`}
            />
            <p className="text-xs text-slate-400">
              <span className="font-medium text-slate-300">Authentification :</span>{' '}
              {data.authRequired ? 'Bearer' : 'désactivée.'}{' '}
              {data.authRequired && (
                <>
                  <code className="text-blue-300">MCP_API_KEY</code> sur chaque requête.{' '}
                </>
              )}
              {authHint} Ouvrir <code className="text-blue-300">{endpointUrl}</code> dans un
              navigateur peut renvoyer un JSON d'erreur — c'est un endpoint pour clients MCP, pas
              une page web.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tools per group */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4 text-blue-400" />
            Tools par groupe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.groups.map((group) => (
              <details
                key={group.name}
                className={`group rounded-lg border p-3 ${groupColors[group.name] ?? 'bg-slate-800/50 text-slate-300 border-slate-700'}`}
                title={group.description}
              >
                <summary className="cursor-pointer list-none">
                  <span className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide opacity-80">{group.name}</span>
                    <span className="text-xs opacity-60 transition-transform group-open:rotate-90" aria-hidden>
                      ▸
                    </span>
                  </span>
                  <span className="mt-1 block text-lg font-semibold">{group.toolCount} tools</span>
                  <span className="mt-1 block truncate text-xs opacity-70 group-open:hidden">
                    {group.tools[0]?.name}
                    {group.toolCount > 1 ? ` +${group.toolCount - 1}` : ''}
                  </span>
                </summary>
                <ul className="mt-2 space-y-1.5 border-t border-current/10 pt-2" aria-label={`Tools ${group.name}`}>
                  {group.tools.map((tool) => (
                    <li key={tool.name} className="text-xs" title={tool.description}>
                      <code className="font-medium">{tool.name}</code>
                      <p className="mt-0.5 line-clamp-2 opacity-60">{tool.description}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Cliquez sur un groupe pour déplier la liste complète de ses tools.
          </p>
        </CardContent>
      </Card>

      {/* Connection snippets */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-blue-400" />
            Comment se connecter
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <CodeBlock
              title="Claude Desktop / .mcp.json"
              code={mcpJson}
            />
            <div className="mt-3">
              <CodeBlock title="Tidet — mcp_server_add (HTTP)" code={tidetSnippet} />
            </div>
          </div>
          <div>
            <CodeBlock title="Tester en ligne de commande (curl)" code={curlSnippet} />
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Remplacez <code className="text-blue-300">&lt;MCP_API_KEY&gt;</code> par la clé configurée
              dans le <code>.env</code> du serveur (variable <code>MCP_API_KEY</code>) — elle n'est jamais
              affichée sur cette page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
