import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Hitech Electric" }] }),
  component: ResetPasswordPage,
});

const ALLOWED_DOMAINS = ["hitech-e.com.br", "milen-ia.com"] as const;
const DOMAIN_ERROR = "Email não autorizado. Use @hitech-e.com.br ou @milen-ia.com.";

function isAllowedEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return !!domain && (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (hash.includes("type=recovery") || search.includes("type=recovery")) {
      setMode("update");
      return;
    }
    // Fallback: detect active recovery session
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
  }, []);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    if (!isAllowedEmail(email)) return toast.error(DOMAIN_ERROR);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Link enviado para seu email. Verifique também a caixa de spam.");
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada.");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-svh bg-background grid place-items-center p-4 sm:p-6 overflow-y-auto">
      <Toaster position="top-center" />
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-md grid place-items-center bg-primary text-primary-foreground">
              <Zap className="size-4" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-wide">HITECH ELECTRIC</span>
          </div>
          <CardTitle className="text-xl">{mode === "update" ? "Definir nova senha" : "Recuperar senha"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "update" ? "Escolha uma nova senha para sua conta." : "Enviaremos um link de recuperação para seu email."}
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {mode === "request" ? (
            <form onSubmit={handleRequest} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Apenas emails @hitech-e.com.br e @milen-ia.com</p>
              </div>
              <Button type="submit" className="w-full h-11 sm:h-10" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin mr-2" />}Enviar link
              </Button>
            </form>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="newpw">Nova senha</Label>
                <Input
                  id="newpw"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
              </div>
              <Button type="submit" className="w-full h-11 sm:h-10" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin mr-2" />}Atualizar senha
              </Button>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link to="/auth" className="text-xs text-primary hover:underline">Voltar para login</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}