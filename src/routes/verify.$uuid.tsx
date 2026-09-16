import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Download } from 'lucide-react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Calendar,
  User,
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  ShieldOff,
  AlertTriangle,
  Building2,
  WifiOff,
} from 'lucide-react';
import { formatFCFA, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/verify/$uuid')({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search['t'] === 'string' ? (search['t'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Vérification de document — GESTI-ONE' },
      {
        name: 'description',
        content:
          "Vérifiez l'authenticité d'un document commercial certifié par EDITIONS FABS-CI.",
      },
      { property: 'og:title', content: 'Vérification de document — GESTI-ONE' },
      {
        property: 'og:description',
        content: "Contrôle public d'authenticité des documents certifiés.",
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: VerificationPage,
});

type ApiStatus =
  | 'AUTHENTIC'
  | 'REVOKED'
  | 'CANCELLED'
  | 'TAMPERED'
  | 'UNCERTIFIED'
  | 'NOT_FOUND';

type VerifyResponse = {
  status: ApiStatus;
  reason?: string | null;
  docType?: string;
  reference?: string;
  date?: string | null;
  client_nom?: string | null;
  representant_nom?: string | null;
  montant?: number | null;
  statut_document?: string | null;
  certification_id?: string | null;
  certified_at?: string | null;
  canonical_hash?: string | null;
  signature_algorithm?: string | null;
  checked_at?: string;
};

/** Une erreur technique (réseau, 5xx, réponse invalide) est distincte d'un document introuvable. */
class VerificationUnavailable extends Error {}

const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,60}$/;

const STATUS_UI: Record<
  ApiStatus,
  {
    title: string;
    subtitle: string;
    text: string;
    badge: string;
    icon: string;
    Icon: typeof CheckCircle2;
    message: string;
  }
> = {
  AUTHENTIC: {
    title: 'Document certifié',
    subtitle: 'Signature numérique valide',
    text: 'text-emerald-700',
    badge: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-600',
    Icon: CheckCircle2,
    message:
      "Ce document est signé numériquement par EDITIONS FABS-CI et son contenu n'a pas été modifié depuis sa certification.",
  },
  UNCERTIFIED: {
    title: 'Document non certifié',
    subtitle: 'Signature numérique absente',
    text: 'text-amber-700',
    badge: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-600',
    Icon: AlertTriangle,
    message:
      "Ce document existe bien dans le registre d'EDITIONS FABS-CI, mais aucune certification numérique n'y est associée. Demandez à l'émetteur une version certifiée avant tout paiement.",
  },
  REVOKED: {
    title: 'Certification révoquée',
    subtitle: 'Document plus valide',
    text: 'text-orange-700',
    badge: 'bg-orange-50 border-orange-200',
    icon: 'text-orange-600',
    Icon: ShieldOff,
    message:
      "La certification de ce document a été révoquée par l'émetteur. Contactez EDITIONS FABS-CI avant tout paiement.",
  },
  CANCELLED: {
    title: 'Document annulé',
    subtitle: 'Annulé par l’émetteur',
    text: 'text-orange-700',
    badge: 'bg-orange-50 border-orange-200',
    icon: 'text-orange-600',
    Icon: ShieldOff,
    message: "Ce document a été annulé et ne doit plus être utilisé.",
  },
  TAMPERED: {
    title: 'Intégrité compromise',
    subtitle: 'Contenu modifié après certification',
    text: 'text-red-700',
    badge: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    Icon: ShieldAlert,
    message:
      "Le contenu enregistré ne correspond plus à la signature numérique d'origine. Ne réglez pas ce document sans confirmation de l'émetteur.",
  },
  NOT_FOUND: {
    title: 'Document introuvable',
    subtitle: 'Aucune correspondance dans le registre',
    text: 'text-slate-700',
    badge: 'bg-slate-100 border-slate-200',
    icon: 'text-slate-500',
    Icon: XCircle,
    message:
      "La référence recherchée ne correspond à aucun document enregistré. Vérifiez la référence ou contactez l'émetteur.",
  },
};

function Row({
  Icon,
  label,
  children,
}: {
  Icon: typeof FileText;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-blue-600 mt-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{label}</p>
        <div className="text-slate-900 font-semibold text-sm break-words leading-snug">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Libellé du bouton de téléchargement selon le type de document vérifié. */
const DOWNLOAD_LABEL: Record<string, string> = {
  FACTURE: 'Télécharger la facture',
  PROFORMA: 'Télécharger la facture proforma',
  COMMANDE: 'Télécharger le bon de commande',
};

function docKeyFromLabel(docType?: string): 'FACTURE' | 'PROFORMA' | 'COMMANDE' | null {
  const v = (docType ?? '').toLowerCase();
  if (v.includes('proforma')) return 'PROFORMA';
  if (v.includes('commande')) return 'COMMANDE';
  if (v.includes('facture')) return 'FACTURE';
  return null;
}

function VerificationPage() {
  const { uuid } = Route.useParams();
  const { t } = Route.useSearch();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const malformed = !REFERENCE_RE.test(uuid);

  const { data, isLoading, isFetching, error, refetch } = useQuery<VerifyResponse>({
    queryKey: ['verify-doc', uuid, t ?? null],
    enabled: !malformed,
    queryFn: async () => {
      let response: Response;
      try {
        response = await fetch(
          `/api/public/verify-doc/${encodeURIComponent(uuid)}${t ? `?t=${encodeURIComponent(t)}` : ''}`,
        );
      } catch {
        throw new VerificationUnavailable('Connexion impossible au service de vérification.');
      }

      if (response.status === 404) {
        return { status: 'NOT_FOUND', reference: uuid } satisfies VerifyResponse;
      }
      if (response.status === 429) {
        throw new VerificationUnavailable(
          'Trop de vérifications successives. Patientez quelques instants puis réessayez.',
        );
      }
      if (!response.ok) {
        throw new VerificationUnavailable(
          "Le service de vérification est momentanément indisponible.",
        );
      }

      const json = (await response.json().catch(() => null)) as VerifyResponse | null;
      if (!json || typeof json.status !== 'string' || !(json.status in STATUS_UI)) {
        throw new VerificationUnavailable('Réponse de vérification invalide.');
      }
      return json;
    },
    staleTime: 0,
    retry: 1,
  });

  const handleBack = () => {
    window.location.href = 'https://editionsfabs.ci';
  };

  const ui = data ? STATUS_UI[data.status] : null;
  const hasDocumentInfo = !!data && data.status !== 'NOT_FOUND' && !!data.reference;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* En-tête */}
        <header className="text-center space-y-2">
          <img
            src="/fabs-logo.png"
            alt="EDITIONS FABS-CI"
            className="h-16 w-auto object-contain mx-auto"
          />
          <div>
            <p className="text-lg font-black tracking-tight text-slate-900">GESTI-ONE</p>
            <p className="text-[11px] text-slate-500 font-medium">
              Système de certification numérique
            </p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em]">
              Éditions FABS-CI
            </p>
          </div>
          <p className="inline-block text-[10px] uppercase font-bold tracking-widest text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
            Vérification officielle de document
          </p>
        </header>

        <main className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-5">
          {malformed ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-fit p-4 rounded-full bg-slate-100 border border-slate-200">
                <XCircle className="h-10 w-10 text-slate-500" />
              </div>
              <h1 className="text-xl font-black text-slate-900">Référence invalide</h1>
              <p className="text-sm text-slate-600">
                Le code scanné ne correspond pas à un format de référence valide.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center space-y-3 py-10">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              <p className="text-slate-500 text-sm font-medium">
                Vérification de l'authenticité...
              </p>
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-fit p-4 rounded-full bg-amber-50 border border-amber-200">
                <WifiOff className="h-10 w-10 text-amber-600" />
              </div>
              <h1 className="text-xl font-black text-slate-900 leading-tight">
                Vérification temporairement indisponible
              </h1>
              <p className="text-sm text-slate-600">
                {(error as Error).message ||
                  "Impossible de confirmer l'authenticité du document pour le moment."}
              </p>
              <Button className="w-full" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Réessayer
              </Button>
            </div>
          ) : ui && data ? (
            <div className="space-y-5">
              {/* Bloc statut */}
              <div className={`rounded-xl border p-4 flex items-start gap-3 ${ui.badge}`}>
                <ui.Icon className={`h-8 w-8 shrink-0 ${ui.icon}`} />
                <div className="min-w-0">
                  <h1 className={`text-base font-black uppercase tracking-tight ${ui.text}`}>
                    {ui.title}
                  </h1>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                    {hasDocumentInfo && data.docType ? `${data.docType} — ` : ''}
                    {ui.subtitle}
                  </p>
                  {data.reason && (
                    <p className="text-[11px] text-slate-500 italic mt-1">Motif : {data.reason}</p>
                  )}
                </div>
              </div>

              <p className="text-[12px] text-slate-600 leading-relaxed">{ui.message}</p>

              {/* Informations document */}
              {hasDocumentInfo && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <Row Icon={FileText} label="Référence officielle">
                    <span className="font-mono">{data.reference}</span>
                    {data.docType && (
                      <span className="block text-[11px] font-medium text-slate-500">
                        {data.docType}
                      </span>
                    )}
                  </Row>

                  {data.date && (
                    <Row Icon={Calendar} label="Date d'émission">
                      {formatDate(data.date)}
                    </Row>
                  )}

                  {data.client_nom && (
                    <Row Icon={User} label="Client">
                      {data.client_nom}
                      {data.representant_nom && (
                        <span className="block text-[11px] text-slate-500 font-medium italic mt-0.5">
                          Rep : {data.representant_nom}
                        </span>
                      )}
                    </Row>
                  )}

                  <Row Icon={Building2} label="Émetteur">
                    EDITIONS FABS-CI
                  </Row>

                  {typeof data.montant === 'number' && (
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                      <p className="text-slate-500 text-sm font-medium">Montant total</p>
                      <p className="text-xl font-black text-blue-900">
                        {formatFCFA(data.montant)}
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200 space-y-1">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                      Certification numérique
                    </p>
                    {data.certified_at ? (
                      <>
                        <p className="text-[11px] text-slate-600">
                          Certifié le {formatDate(data.certified_at)} •{' '}
                          {data.signature_algorithm ?? 'Ed25519'}
                        </p>
                        {data.certification_id && (
                          <p className="font-mono text-[10px] text-slate-400 break-all">
                            ID : {data.certification_id}
                          </p>
                        )}
                        {data.canonical_hash && (
                          <p className="font-mono text-[10px] text-slate-400 break-all">
                            SHA-256 : {data.canonical_hash}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Aucune signature numérique enregistrée pour ce document.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {data.checked_at && (
                <p className="text-[10px] text-slate-400 text-center">
                  Dernière vérification : {new Date(data.checked_at).toLocaleString('fr-FR')}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  Revérifier
                </Button>
                <Button variant="ghost" className="flex-1 text-slate-500" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Site officiel
                </Button>
              </div>
            </div>
          ) : null}
        </main>

        <footer className="flex flex-col items-center space-y-1 opacity-60 pt-2">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
            Certification digitale • Editions FABS-CI
          </p>
          <p className="text-slate-400 text-[10px]">
            © {new Date().getFullYear()} Tous droits réservés.
          </p>
        </footer>
      </div>
    </div>
  );
}
