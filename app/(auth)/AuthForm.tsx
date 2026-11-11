"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { sendMagicLink, signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, {});
  const [magic, magicAction, magicPending] = useActionState<AuthState, FormData>(sendMagicLink, {});
  const feedback = state.error || magic.error ? (
    <p role="alert" className="text-sm text-danger">{state.error ?? magic.error}</p>
  ) : state.message || magic.message ? (
    <p className="text-sm text-success">{state.message ?? magic.message}</p>
  ) : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="mb-5 text-sm text-muted">Suas finanças, sincronizadas com seus bancos.</p>
        <form action={action} className="space-y-3">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>
          {feedback}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
          {mode === "login" && (
            <Button type="submit" formAction={magicAction} formNoValidate variant="secondary" className="w-full" disabled={magicPending}>
              Receber link de acesso por e-mail
            </Button>
          )}
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          {mode === "login" ? (
            <>Não tem conta? <Link className="text-primary hover:underline" href="/signup">Cadastre-se</Link></>
          ) : (
            <>Já tem conta? <Link className="text-primary hover:underline" href="/login">Entrar</Link></>
          )}
        </p>
      </Card>
    </div>
  );
}
