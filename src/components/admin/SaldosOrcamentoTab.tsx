import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InitialBalancesTab } from "@/components/admin/InitialBalancesTab";
import { BudgetTab } from "@/components/admin/BudgetTab";
import { PrevistoRealizadoTab } from "@/components/admin/PrevistoRealizadoTab";

export function SaldosOrcamentoTab({ companyId }: { companyId: string | null | undefined }) {
  return (
    <Tabs defaultValue="saldos" className="space-y-4">
      <TabsList className="bg-background border border-border">
        <TabsTrigger value="saldos">Saldos iniciais</TabsTrigger>
        <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
        <TabsTrigger value="previsto">Previsto x Realizado</TabsTrigger>
      </TabsList>
      <TabsContent value="saldos">
        <InitialBalancesTab companyId={companyId} />
      </TabsContent>
      <TabsContent value="orcamento">
        <BudgetTab companyId={companyId} />
      </TabsContent>
      <TabsContent value="previsto">
        <PrevistoRealizadoTab companyId={companyId} />
      </TabsContent>
    </Tabs>
  );
}
