"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/pipeline";
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        if (error.message.includes("Invalid login")) {
          toast.error("E-mail ou senha incorretos");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Login realizado com sucesso!");
      // Hard redirect evita problemas com Navigator Lock e garante que o middleware
      // leia os cookies atualizados na próxima requisição
      window.location.href = redirect;
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  const errorParam = searchParams.get("error");

  return (
    <div className="animate-fade-in space-y-8">
      {/* Logo & Title */}
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-lg shadow-adds-blue/10 ring-1 ring-border">
          <Logo size="lg" className="h-12 w-12" priority />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          ADDS CRM
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Acesse sua conta para continuar
        </p>
      </div>

      {/* Error messages */}
      {errorParam === "inactive" && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-center text-sm text-destructive">
          Sua conta está inativa. Contate o administrador.
        </div>
      )}
      {errorParam === "locked" && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center text-sm text-amber-600 dark:text-amber-400">
          Conta temporariamente bloqueada. Tente novamente em 10 minutos.
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Email */}
          <div className="px-4 py-3.5">
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              E-mail
            </label>
            <input
              {...register("email")}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              disabled={isLoading}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Password */}
          <div className="px-4 py-3.5">
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Senha
            </label>
            <div className="flex items-center gap-2">
              <input
                {...register("password")}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        {/* Forgot password */}
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground transition-colors hover:text-adds-blue"
          >
            Esqueceu sua senha?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-adds-blue to-adds-blue/90 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-adds-blue/25 transition-all hover:shadow-xl hover:shadow-adds-blue/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground/60">
        ADDS Brasil LTDA &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
