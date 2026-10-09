import { COMPANY } from "@/lib/company";
import { formatDocumentReference } from "@/lib/document-reference";
import { formatDateTime } from "@/lib/format";
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
import { PAYMENT_STATUS_COLOR } from '@/lib/factures/payment-status';

/** Site officiel vers lequel pointe le bouton « Site officiel » de la page de vérification. */
const OFFICIAL_SITE_URL = 'https://editions-fabsci.lovable.app/';

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
  paiement?: {
    totalAPayer: number;
    montantPaye: number;
    resteAPayer: number;
    statut: string;
  } | null;
  statut_document?: string | null;
  releve?: {
    edite_le: string;
    periode: string;
    client: { nom: string; code: string | null; ville: string | null; telephone: string | null; representant: string | null };
    lignes: Array<{ date: string; reference: string; libelle: string; debit: number; paiement: number; retour: number; solde: number }>;
    totalDebit: number;
    totalPaiement: number;
    totalRetours: number;
    totalTransport: number;
    solde: number;
  } | null;
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
    text: 'text-success',
    badge: 'bg-success/10 border-success/40',
    icon: 'text-success',
    Icon: CheckCircle2,
    message:
      "Ce document est signé numériquement par EDITIONS FABS-CI et son contenu n'a pas été modifié depuis sa certification.",
  },
  UNCERTIFIED: {
    title: 'Document non certifié',
    subtitle: 'Signature numérique absente',
    text: 'text-warning',
    badge: 'bg-warning/10 border-warning/40',
    icon: 'text-warning',
    Icon: AlertTriangle,
    message:
      "Ce document existe bien dans le registre d'EDITIONS FABS-CI, mais aucune certification numérique n'y est associée. Demandez à l'émetteur une version certifiée avant tout paiement.",
  },
  REVOKED: {
    title: 'Certification révoquée',
    subtitle: 'Document plus valide',
    text: 'text-warning',
    badge: 'bg-warning/10 border-warning/40',
    icon: 'text-warning',
    Icon: ShieldOff,
    message:
      "La certification de ce document a été révoquée par l'émetteur. Contactez EDITIONS FABS-CI avant tout paiement.",
  },
  CANCELLED: {
    title: 'Document annulé',
    subtitle: 'Annulé par l’émetteur',
    text: 'text-warning',
    badge: 'bg-warning/10 border-warning/40',
    icon: 'text-warning',
    Icon: ShieldOff,
    message: "Ce document a été annulé et ne doit plus être utilisé.",
  },
  TAMPERED: {
    title: 'Intégrité compromise',
    subtitle: 'Contenu modifié après certification',
    text: 'text-destructive',
    badge: 'bg-destructive/10 border-destructive/40',
    icon: 'text-destructive',
    Icon: ShieldAlert,
    message:
      "Le contenu enregistré ne correspond plus à la signature numérique d'origine. Ne réglez pas ce document sans confirmation de l'émetteur.",
  },
  NOT_FOUND: {
    title: 'Document introuvable',
    subtitle: 'Aucune correspondance dans le registre',
    text: 'text-foreground',
    badge: 'bg-muted border-border',
    icon: 'text-muted-foreground',
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
      <Icon className="h-4 w-4 text-info mt-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-bold">{label}</p>
        <div className="text-foreground font-semibold text-sm break-words leading-snug">
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
  PAIEMENT: 'Télécharger le reçu de paiement',
  RELEVE: 'Télécharger le relevé de compte',
};

function docKeyFromLabel(docType?: string): 'FACTURE' | 'PROFORMA' | 'COMMANDE' | 'PAIEMENT' | 'RELEVE' | null {
  const v = (docType ?? '').toLowerCase();
  if (v.includes('relevé') || v.includes('releve')) return 'RELEVE';
  if (v.includes('reçu') || v.includes('paiement')) return 'PAIEMENT';
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


  const ui = data ? STATUS_UI[data.status] : null;
  const hasDocumentInfo = !!data && data.status !== 'NOT_FOUND' && !!data.reference;

  // Téléchargement réservé aux documents authentiques Facture / Proforma / Bon de commande.
  const downloadKey =
    data?.status === 'AUTHENTIC' ? docKeyFromLabel(data.docType) : null;

  const handleDownload = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/public/verify-doc/${encodeURIComponent(uuid)}/document${t ? `?t=${encodeURIComponent(t)}` : ''}`,
      );
      if (!res.ok) throw new Error('indisponible');
      const payload = (await res.json()) as {
        label: 'Facture' | 'Proforma' | 'Commande' | 'Reçu' | 'Relevé';
        reference: string;
        data: Record<string, unknown>;
      };
      const [{ generateUnifiedCommercialPDF, generateUnifiedReceiptPDF, generateUnifiedStatementPDF }, { downloadBlob }] = await Promise.all([
        import('@/lib/pdf/unified-generator'),
        import('@/lib/pdf/fabsTemplates'),
      ]);
      const blob =
        payload.label === 'Relevé'
          ? await generateUnifiedStatementPDF(payload.data)
          : payload.label === 'Reçu'
          ? await generateUnifiedReceiptPDF(payload.data as never)
          : await generateUnifiedCommercialPDF(payload.label, payload.data as never);
      downloadBlob(blob, `${payload.reference}.pdf`);
    } catch {
      setDownloadError(
        'Le document est actuellement indisponible au téléchargement. Veuillez réessayer.',
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex flex-col items-center px-4 py-8">
      <div className={`w-full ${data?.releve ? "max-w-4xl" : "max-w-md"} space-y-4`}>
        {/* En-tête */}
        <header className="text-center space-y-2">
          <img
            src="/fabs-logo.png"
            alt="EDITIONS FABS-CI"
            className="h-16 w-auto object-contain mx-auto"
          />
          <div>
            <p className="text-lg font-black tracking-tight text-foreground">GESTI-ONE</p>
            <p className="text-xs text-muted-foreground font-medium">
              Système de certification numérique
            </p>
            <p className="text-xs text-muted-foreground font-bold">
              Éditions FABS-CI
            </p>
          </div>
          <p className="inline-block text-xs font-bold text-info bg-info/10 border border-info/40 rounded-full px-3 py-1">
            Vérification officielle de document
          </p>
        </header>

        <main className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-5">
          {malformed ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-fit p-4 rounded-full bg-muted border border-border">
                <XCircle className="h-10 w-10 text-muted-foreground" />
              </div>
              <h1 className="ds-page-title text-foreground">Référence invalide</h1>
              <p className="text-sm text-muted-foreground">
                Le code scanné ne correspond pas à un format de référence valide.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center space-y-3 py-10">
              <Loader2 className="h-10 w-10 text-info animate-spin" />
              <p className="text-muted-foreground text-sm font-medium">
                Vérification de l'authenticité...
              </p>
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-fit p-4 rounded-full bg-warning/10 border border-warning/40">
                <WifiOff className="h-10 w-10 text-warning" />
              </div>
              <h1 className="ds-page-title text-foreground">
                Vérification temporairement indisponible
              </h1>
              <p className="text-sm text-muted-foreground">
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
                  <p className="text-xs font-bold text-muted-foreground">
                    {hasDocumentInfo && data.docType ? `${data.docType} — ` : ''}
                    {ui.subtitle}
                  </p>
                  {data.reason && (
                    <p className="text-xs text-muted-foreground italic mt-1">Motif : {data.reason}</p>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{ui.message}</p>

              {/* Informations document */}
              {hasDocumentInfo && (
                <div className="rounded-xl border border-border bg-muted p-4 space-y-4">
                  <Row Icon={FileText} label="Référence officielle">
                    <span className="font-mono">{data.reference}</span>
                    {data.docType && (
                      <span className="block text-xs font-medium text-muted-foreground">
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
                        <span className="block text-xs text-muted-foreground font-medium mt-0.5">
                          Rep : {data.representant_nom}
                        </span>
                      )}
                    </Row>
                  )}

                  <Row Icon={Building2} label="Émetteur">
                    EDITIONS FABS-CI
                  </Row>

                  {data.releve && <ReleveDetail releve={data.releve} />}

                  {!data.releve && typeof data.montant === 'number' && (
                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <p className="text-muted-foreground text-sm font-medium">Montant total</p>
                      <p className="text-xl font-black text-info">
                        {formatFCFA(data.montant)}
                      </p>
                    </div>
                  )}

                  {data.paiement && (
                    <div className="pt-3 border-t border-border space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-muted-foreground">
                          Statut de paiement
                        </p>
                        <span
                          className="text-sm font-black uppercase text-right break-words"
                          style={{ color: PAYMENT_STATUS_COLOR }}
                        >
                          {data.paiement.statut}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-muted-foreground">Montant payé</p>
                        <p className="text-sm font-bold" style={{ color: PAYMENT_STATUS_COLOR }}>
                          {formatFCFA(data.paiement.montantPaye)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-muted-foreground">Reste à payer</p>
                        <p className="text-sm font-bold" style={{ color: PAYMENT_STATUS_COLOR }}>
                          {formatFCFA(data.paiement.resteAPayer)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-border space-y-1">
                    <p className="text-xs text-muted-foreground font-bold">
                      Certification numérique
                    </p>
                    {data.certified_at ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Certifié le {formatDate(data.certified_at)} •{' '}
                          {data.signature_algorithm ?? 'Ed25519'}
                        </p>
                        {data.certification_id && (
                          <p className="font-mono text-xs text-muted-foreground break-all">
                            ID : {data.certification_id}
                          </p>
                        )}
                        {data.canonical_hash && (
                          <p className="font-mono text-xs text-muted-foreground break-all">
                            SHA-256 : {data.canonical_hash}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Aucune signature numérique enregistrée pour ce document.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {data.checked_at && (
                <p className="text-xs text-muted-foreground text-center">
                  Dernière vérification : {formatDateTime(data.checked_at)}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  Revérifier
                </Button>
                {downloadKey && (
                  <Button
                    className="flex-1 bg-info hover:bg-info text-white"
                    onClick={() => void handleDownload()}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {downloading ? 'Préparation…' : DOWNLOAD_LABEL[downloadKey]}
                  </Button>
                )}
              </div>

              {downloadError && (
                <p className="text-xs text-warning text-center">{downloadError}</p>
              )}

              <div className="flex">
                <Button variant="ghost" className="flex-1 text-muted-foreground" asChild>
                  <a href={OFFICIAL_SITE_URL}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Site officiel
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </main>

        <footer className="flex flex-col items-center space-y-1 opacity-60 pt-2">
          <p className="text-muted-foreground text-xs font-bold">
            Certification digitale • Editions FABS-CI
          </p>
          <p className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} Tous droits réservés.
          </p>
        </footer>
      </div>
    </div>
  );
}

const RC_RCCM = "CI-ABJ-2020-B-12345";
const RC_NCC = "2302562N";

function fmtDay(d: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d || "—";
}

function ReleveDetail({ releve }: { releve: NonNullable<VerifyResponse["releve"]> }) {
  const r = releve;
  const edit = new Date(r.edite_le);
  const sumDebit = r.lignes.reduce((a, l) => a + l.debit, 0);
  const sumPaie = r.lignes.reduce((a, l) => a + l.paiement, 0);
  const sumRet = r.lignes.reduce((a, l) => a + l.retour, 0);
  const ecarts: string[] = [];
  if (r.lignes.length === 0) ecarts.push("Aucune opération n'est enregistrée sur ce relevé.");
  if (Math.abs(sumDebit - r.totalDebit) > 1) ecarts.push("Le total débit ne correspond pas à la somme des lignes.");
  if (Math.abs(sumPaie - r.totalPaiement) > 1) ecarts.push("Le total des paiements ne correspond pas à la somme des lignes.");
  if (Math.abs(sumRet - r.totalRetours) > 1) ecarts.push("Le total des retours ne correspond pas à la somme des lignes.");
  const money = (v: number) => (v ? formatFCFA(v) : "");
  const recap: Array<[string, number, boolean?]> = [["Total débit", r.totalDebit]];
  if (r.totalPaiement) recap.push(["Total des paiements", r.totalPaiement]);
  if (r.totalRetours) recap.push(["Total des retours", r.totalRetours]);
  if (r.totalTransport) recap.push(["Frais de transport compris dans les factures", r.totalTransport]);
  recap.push([r.solde < 0 ? "Solde créditeur" : "Solde débiteur", Math.abs(r.solde), true]);
  if (r.solde > 0) recap.push(["Montant total impayé", r.solde]);

  return (
    <div className="pt-3 border-t border-border space-y-4">
      <div className="text-center">
        <p className="text-base font-black tracking-wide text-foreground">RELEVÉ DE COMPTE</p>
        <p className="text-xs text-muted-foreground">
          Édité le {fmtDay(r.edite_le)} à {edit.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {r.periode}
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {([
          ["Client", r.client.nom],
          ["Code client", r.client.code],
          ["Ville", r.client.ville],
          ["Représentant", r.client.representant],
          ["Téléphone", r.client.telephone],
        ] as const).filter(([, v]) => v).map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-bold text-muted-foreground">{k}</dt>
            <dd className="font-semibold text-foreground break-words">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-xs tabular-nums">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Référence</th>
              <th className="px-2 py-2 text-left">Libellé</th>
              <th className="px-2 py-2 text-right">Débit</th>
              <th className="px-2 py-2 text-right">Paiement</th>
              <th className="px-2 py-2 text-right">Retour</th>
              <th className="px-2 py-2 text-right">Solde</th>
            </tr>
          </thead>
          <tbody>
            {r.lignes.map((l, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-2 py-2 whitespace-nowrap">{fmtDay(l.date)}</td>
                <td className="px-2 py-2 font-mono whitespace-nowrap">{formatDocumentReference(l.reference)}</td>
                <td className="px-2 py-2">{l.libelle}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap">{money(l.debit)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap">{money(l.paiement)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap">{money(l.retour)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap font-semibold">{formatFCFA(l.solde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:ml-auto sm:max-w-sm space-y-1.5">
        {recap.map(([k, v, strong]) => (
          <div key={k} className={`flex justify-between gap-3 text-sm ${strong ? "pt-1.5 border-t border-border font-black" : ""}`}>
            <span className="text-muted-foreground">{k}</span>
            <span className="tabular-nums text-foreground">{formatFCFA(v)}</span>
          </div>
        ))}
      </div>

      {ecarts.length > 0 && (
        <div className="rounded-md border border-warning p-3 text-xs text-warning space-y-1">
          {ecarts.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      <div className="pt-3 border-t border-border text-xs text-muted-foreground text-center space-y-0.5">
        <p className="font-bold text-foreground">{COMPANY.nom}</p>
        <p>{COMPANY.adresse}</p>
        <p>Tél. : {COMPANY.telephones.join(" / ")} · {COMPANY.email}</p>
        <p>RCCM : {RC_RCCM} · NCC : {RC_NCC}</p>
      </div>
    </div>
  );
}
