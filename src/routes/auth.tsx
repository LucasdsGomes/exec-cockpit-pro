import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Hitech Electric" },
      { name: "description", content: "Acesse o cockpit financeiro Hitech Electric." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/" });
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já está conectado.");
    navigate({ to: "/" });
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      <Toaster />
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md grid place-items-center bg-primary text-primary-foreground">
            <Zap className="size-6" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-wide">HITECH ELECTRIC</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Cockpit Financeiro</div>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Acesso restrito</div>
          <h1 className="text-3xl font-semibold tracking-tight">DRE, fluxo de caixa, ciclo financeiro e projeção do balanço — em um único cockpit.</h1>
          <p className="text-sm text-muted-foreground">Integração nativa com OMIE, regras gerenciais editáveis e snapshots auditáveis.</p>
        </div>
        <div className="text-xs text-muted-foreground">© Hitech Electric — Visão executiva</div>
      </div>

      {/* Auth panel */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="space-y-1">
            <div className="lg:hidden flex items-center gap-2 mb-2">
              <div className="size-8 rounded-md grid place-items-center bg-primary text-primary-foreground">
                <Zap className="size-4" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-semibold tracking-wide">HITECH ELECTRIC</span>
            </div>
            <CardTitle className="text-xl">Acesse sua conta</CardTitle>
            <p className="text-sm text-muted-foreground">Entre com email/senha ou Google.</p>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@hitech.com.br" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Senha</Label>
                      <Link to="/reset-password" className="text-xs text-primary hover:underline">Esqueci a senha</Link>
                    </div>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="size-4 animate-spin mr-2" />}Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname">Nome completo</Label>
                    <Input id="fullname" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password2">Senha</Label>
                    <Input id="password2" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <p className="text-[11px] text-muted-foreground">Mín. 8 caracteres. Senhas vazadas são bloqueadas.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="size-4 animate-spin mr-2" />}Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
              <svg className="size-4 mr-2" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .55 4.1 1.6l3-3C17.2 1.85 14.8 1 12 1 7.3 1 3.2 3.7 1.3 7.6l3.5 2.7C5.7 7.4 8.6 5 12 5z"/><path fill="#4285F4" d="M23 12c0-.8-.1-1.6-.2-2.4H12v4.5h6.2c-.3 1.4-1.1 2.5-2.3 3.3l3.6 2.8C21.7 18 23 15.2 23 12z"/><path fill="#FBBC05" d="M4.8 14.3a7 7 0 0 1 0-4.6L1.3 7C-.4 10.2-.4 13.8 1.3 17l3.5-2.7z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-3.4 0-6.3-2.4-7.2-5.3L1.3 17C3.2 20.3 7.3 23 12 23z"/></svg>
              Continuar com Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}