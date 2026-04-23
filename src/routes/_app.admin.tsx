import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, RefreshCw, Plug, AlertTriangle, FileWarning } from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Hitech Electric" },
      { name: "description", content: "Status de integrações, DE-PARA, orçamento, ajustes manuais e fila de classificação." },
    ],
  }),
  component: AdminPage,
});

const integracoes = [
  { nome: "OMIE • Lançamentos", status: "ok", ultima: "Hoje 09:42", erros: 0 },
  { nome: "OMIE • Contas a pagar", status: "ok", ultima: "Hoje 09:42", erros: 0 },
  { nome: "OMIE • Contas a receber", status: "ok", ultima: "Hoje 09:41", erros: 0 },
  { nome: "OMIE • Plano de contas", status: "warn", ultima: "Ontem 18:10", erros: 2 },
];

const fila = [
  { data: "23/04", historico: "PIX recebido — ref. 12842", valor: 18_400 },
  { data: "23/04", historico: "Boleto pago — Distribuidora Volt", valor: -42_100 },
  { data: "22/04", historico: "TED — pagamento serviço", valor: -7_900 },
];

const depara = [
  { omie: "Receita Bruta Mercadorias", gerencial: "Vendas Produto" },
  { omie: "Receita Serviços Engenharia", gerencial: "Vendas Serviço" },
  { omie: "Compra de Mercadorias", gerencial: "CMV" },
  { omie: "Folha de Pagamento", gerencial: "Pessoal" },
];

function AdminPage() {
  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Configurações</div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Administração</h1>
          <p className="text-sm text-muted-foreground mt-1">Integrações OMIE, DE-PARA gerencial, orçamento e ajustes</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <RefreshCw className="size-4" /> Atualizar agora
        </Button>
      </header>

      <Tabs defaultValue="integracoes">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="depara">DE-PARA</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="saldos">Saldos iniciais</TabsTrigger>
          <TabsTrigger value="ajustes">Ajustes manuais</TabsTrigger>
          <TabsTrigger value="fila">Fila de classificação</TabsTrigger>
        </TabsList>

        <TabsContent value="integracoes" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Plug className="size-4 text-primary" /> OMIE — Credenciais</CardTitle>
                <Badge variant="outline" className="border-success/40 text-success bg-success/10">Conectado</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="App Key" value="••••••••••8421" />
                <Field label="App Secret" value="••••••••••••••••" />
                <Field label="Base URL" value="https://app.omie.com.br/api/v1/" />
                <Button variant="outline" size="sm">Testar conexão</Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-base">Status dos endpoints</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {integracoes.map((i) => (
                    <div key={i.nome} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2 text-sm">
                        {i.status === "ok"
                          ? <CheckCircle2 className="size-4 text-success" />
                          : <AlertTriangle className="size-4 text-warning" />}
                        <span>{i.nome}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {i.ultima} {i.erros > 0 && <span className="text-warning ml-2">{i.erros} erros</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Logs recentes</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-background border border-border rounded-md p-3 overflow-auto max-h-56 text-muted-foreground">
{`[2026-04-23 09:42:01] INFO  OMIE.lancamentos sync OK (1.842 registros)
[2026-04-23 09:42:00] INFO  OMIE.contas_pagar sync OK (412 registros)
[2026-04-23 09:41:58] INFO  OMIE.contas_receber sync OK (528 registros)
[2026-04-22 18:10:04] WARN  OMIE.plano_contas — 2 contas sem mapeamento DE-PARA
[2026-04-22 09:40:11] INFO  Reprocessamento manual concluído por CFO Hitech`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depara" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">DE-PARA contábil → gerencial</CardTitle>
              <Button size="sm" variant="outline">Adicionar mapeamento</Button>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2.5">Conta OMIE</th>
                    <th className="py-2.5">Categoria gerencial</th>
                    <th className="py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {depara.map((d, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="py-2.5">{d.omie}</td>
                      <td className="py-2.5"><Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">{d.gerencial}</Badge></td>
                      <td className="py-2.5 text-right"><Button variant="ghost" size="sm">Editar</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orcamento" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Orçamento anual por categoria</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Importação via planilha ou edição inline. Comparativos automáticos disponíveis em DRE e Home.
              </p>
              <Button size="sm" variant="outline" className="mt-3">Importar planilha</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saldos" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Saldos iniciais por conta</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Itaú CC 12345-6" value="R$ 1.245.000" />
              <Field label="Bradesco CC 98765-4" value="R$ 980.000" />
              <Field label="Santander CC 55555-1" value="R$ 578.000" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ajustes" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Ajustes manuais</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Lançamentos extra-contábeis (estoques, provisões, ajustes de PME) ficam isolados aqui e não sobrescrevem os dados do OMIE.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fila" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><FileWarning className="size-4 text-warning" /> Pendentes de classificação</CardTitle>
              <Button size="sm" variant="outline">Reprocessar</Button>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2.5">Data</th>
                    <th className="py-2.5">Histórico</th>
                    <th className="py-2.5 text-right">Valor</th>
                    <th className="py-2.5 text-right">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {fila.map((f, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="py-2.5">{f.data}</td>
                      <td className="py-2.5">{f.historico}</td>
                      <td className={`py-2.5 text-right tabular-nums ${f.valor < 0 ? "text-destructive" : "text-success"}`}>
                        {f.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="outline">Classificar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <Input value={value} readOnly className="bg-input/60 border-border font-mono text-xs" />
    </div>
  );
}