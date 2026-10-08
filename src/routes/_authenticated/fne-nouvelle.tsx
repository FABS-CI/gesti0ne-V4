import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Code, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  submitFNEInvoice,
  type FNEInvoiceItem,
  type FNETemplate,
  type FNEPaymentMethod,
} from "@/lib/fne-api";
import { formatFCFA } from "@/lib/format";
import { invalidateFne } from "@/lib/cache-invalidation";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/fne-nouvelle")({ component: NewFNE });

function NewFNE() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"form" | "json">("form");
  const [template, setTemplate] = useState<FNETemplate>("B2C");
  const [paymentMethod, setPaymentMethod] = useState<FNEPaymentMethod>("cash");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNcc, setClientNcc] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [commercialMessage, setCommercialMessage] = useState("");
  const [footer, setFooter] = useState("");
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<FNEInvoiceItem[]>([
    { reference: "ART-001", description: "", quantity: 1, amount: 0, discount: 0, taxes: ["TVA"] },
  ]);

  const totals = useMemo(() => {
    const sousTotal = items.reduce((s, it) => s + it.quantity * it.amount, 0);
    const remisesLignes = items.reduce(
      (s, it) => s + (it.quantity * it.amount * (it.discount ?? 0)) / 100,
      0,
    );
    const ht = sousTotal - remisesLignes - discount;
    const tva = ht * 0.18;
    return { sousTotal, remisesLignes, ht, tva, ttc: ht + tva };
  }, [items, discount]);

  const payload = {
    invoiceType: "sale" as const,
    template,
    paymentMethod,
    clientCompanyName: clientName,
    clientPhone,
    clientNcc: clientNcc || null,
    clientEmail: clientEmail || null,
    clientSellerName: sellerName || null,
    commercialMessage: commercialMessage || null,
    footer: footer || null,
    items,
    discount,
  };

  const submit = useMutation({
    mutationFn: () => submitFNEInvoice(payload),
    onSuccess: (d) => {
      toast.success(`Certifiée — code DGI ${d.code_dgi}`);
      invalidateFne(qc);
      nav({ to: "/fne-detail/$factureId", params: { factureId: d.fne_id } });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const canSubmit =
    clientName.trim() &&
    clientPhone.trim() &&
    items.every((it) => it.description.trim() && it.amount > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/fne">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode(mode === "form" ? "json" : "form")}
          >
            <Code className="h-4 w-4 mr-1" />
            {mode === "form" ? "Voir JSON" : "Voir formulaire"}
          </Button>
          <Button
            disabled={!canSubmit || submit.isPending}
            onClick={() => submit.mutate()}
            style={{ backgroundColor: "#FF6200", color: "#fff" }}
          >
            <Send className="h-4 w-4 mr-1" />
            {submit.isPending ? "Soumission…" : "Soumettre à la DGI"}
          </Button>
        </div>
      </div>

      {mode === "json" ? (
        <Card>
          <CardContent className="p-0">
            <pre className="bg-[#0A2540] text-success text-xs p-4 rounded overflow-auto max-h-[70vh]">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Client & paramètres</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label>Template</Label>
                <Select value={template} onValueChange={(v) => setTemplate(v as FNETemplate)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["B2B", "B2C", "B2G", "B2F"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mode de paiement</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as FNEPaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      ["cash", "card", "check", "mobile-money", "transfer", "deferred"] as const
                    ).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Nom client *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <Label>Téléphone *</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div>
                <Label>NCC client</Label>
                <Input
                  value={clientNcc}
                  onChange={(e) => setClientNcc(e.target.value)}
                  placeholder="(B2B uniquement)"
                />
              </div>
              <div>
                <Label>Vendeur</Label>
                <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Message commercial</Label>
                <Textarea
                  rows={2}
                  value={commercialMessage}
                  onChange={(e) => setCommercialMessage(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label>Pied de page</Label>
                <Textarea rows={2} value={footer} onChange={(e) => setFooter(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Sous-total</span>
                <span>{formatFCFA(totals.sousTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Remises lignes</span>
                <span>- {formatFCFA(totals.remisesLignes)}</span>
              </div>
              <div>
                <Label className="text-xs">Remise globale</Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Total HT</span>
                <span>{formatFCFA(totals.ht)}</span>
              </div>
              <div className="flex justify-between">
                <span>TVA 18%</span>
                <span>{formatFCFA(totals.tva)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>TOTAL TTC</span>
                <span>{formatFCFA(totals.ttc)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Lignes de facture</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems([
                    ...items,
                    {
                      reference: `ART-${items.length + 1}`,
                      description: "",
                      quantity: 1,
                      amount: 0,
                      discount: 0,
                      taxes: ["TVA"],
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Réf.</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20">Qté</TableHead>
                    <TableHead className="w-28">PU</TableHead>
                    <TableHead className="w-20">Remise %</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          value={it.reference}
                          onChange={(e) => {
                            const a = [...items];
                            a[i] = { ...it, reference: e.target.value };
                            setItems(a);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={it.description}
                          onChange={(e) => {
                            const a = [...items];
                            a[i] = { ...it, description: e.target.value };
                            setItems(a);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => {
                            const a = [...items];
                            a[i] = { ...it, quantity: Number(e.target.value) || 0 };
                            setItems(a);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={it.amount}
                          onChange={(e) => {
                            const a = [...items];
                            a[i] = { ...it, amount: Number(e.target.value) || 0 };
                            setItems(a);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={it.discount ?? 0}
                          onChange={(e) => {
                            const a = [...items];
                            a[i] = { ...it, discount: Number(e.target.value) || 0 };
                            setItems(a);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatFCFA(it.quantity * it.amount * (1 - (it.discount ?? 0) / 100))}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setItems(items.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
