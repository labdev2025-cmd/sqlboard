"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })
    if (error) {
      setPending(false)
      setError(
        error.status === 429
          ? "Muitas tentativas. Aguarde um minuto e tente de novo."
          : error.status === 403
            ? (error.message ?? "Acesso negado.")
            : "E-mail ou senha incorretos."
      )
      return
    }
    router.replace("/")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Use o e-mail e a senha da sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate={false}>
          <FieldGroup>
            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                placeholder="voce@exemplo.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                required
              />
            </Field>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Entrar
              </Button>
              <FieldDescription className="text-center">
                Não tem conta? Peça a um administrador.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
