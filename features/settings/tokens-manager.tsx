"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRoundIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { CopyField } from "@/components/copy-field"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { api, errorMessage, fieldErrors } from "@/lib/api-client"

type TokenView = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

const expiryItems = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
  { value: "never", label: "Nunca expira" },
]

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—"

export function TokensManager({ origin }: { origin: string }) {
  const queryClient = useQueryClient()
  const tokens = useQuery({
    queryKey: ["tokens"],
    queryFn: () => api<TokenView[]>("/api/tokens"),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.add({ title: "Token revogado", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["tokens"] })
    },
    onError: (error) =>
      toast.add({
        title: "Não foi possível revogar",
        description: errorMessage(error),
        type: "error",
      }),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-sm text-muted-foreground">
          Tokens dão a agentes de IA (MCP) e scripts o mesmo acesso que você
          tem. Trate como senha: crie um por uso e revogue o que não usar mais.
        </p>
        <CreateTokenDialog origin={origin} />
      </div>
      {tokens.isPending ? (
        <Skeleton className="h-24 w-full" aria-busy="true" />
      ) : tokens.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(tokens.error)}</AlertDescription>
        </Alert>
      ) : tokens.data.length === 0 ? (
        <EmptyState
          icon={KeyRoundIcon}
          title="Nenhum token"
          description="Crie um token para conectar um agente via MCP."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table aria-label="Tokens de API">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Criado</TableHead>
                <TableHead className="hidden md:table-cell">
                  Último uso
                </TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.data.map((token) => (
                <TableRow key={token.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium break-words">
                        {token.name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {token.prefix}…
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {date(token.createdAt)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {date(token.lastUsedAt)}
                  </TableCell>
                  <TableCell>
                    {token.expiresAt ? date(token.expiresAt) : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Revogar ${token.name}`}
                            disabled={
                              revoke.isPending && revoke.variables === token.id
                            }
                          />
                        }
                      >
                        <Trash2Icon />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Revogar “{token.name}”?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Agentes e scripts que usam este token perdem o
                            acesso na hora.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => revoke.mutate(token.id)}
                          >
                            Revogar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <section className="flex flex-col gap-2" aria-labelledby="mcp-howto">
        <h2 id="mcp-howto" className="text-base font-medium">
          Conectar um agente (MCP)
        </h2>
        <p className="text-sm text-muted-foreground">
          Endereço do servidor MCP (HTTP):{" "}
          <code className="break-all">{origin}/api/mcp</code>, com o cabeçalho{" "}
          <code>Authorization: Bearer &lt;token&gt;</code>. O agente cria e
          edita rascunhos; publicar continua sendo feito por você na tela. O
          passo a passo para cada IA está em{" "}
          <Link href="/ai" className="underline underline-offset-4">
            Conectar IA
          </Link>
          .
        </p>
      </section>
    </div>
  )
}

function CreateTokenDialog({ origin }: { origin: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [expiry, setExpiry] = React.useState("90")
  const create = useMutation({
    mutationFn: () =>
      api<TokenView & { token: string }>("/api/tokens", {
        method: "POST",
        body: {
          name,
          expiresInDays: expiry === "never" ? null : Number(expiry),
        },
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["tokens"] }),
  })
  const created = create.data

  const errors = fieldErrors(create.error)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setName("")
          setExpiry("90")
          create.reset()
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Novo token
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Token criado</DialogTitle>
              <DialogDescription>
                Copie agora: por segurança ele não será mostrado de novo.
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <KeyRoundIcon />
              <AlertTitle>{created.name}</AlertTitle>
              <AlertDescription>
                Guarde num cofre de senhas ou na configuração do agente.
              </AlertDescription>
            </Alert>
            <CopyField value={created.token} label="Token" />
            <CopyField value={`${origin}/api/mcp`} label="Endereço MCP" />
            <DialogFooter>
              <DialogClose render={<Button />}>Concluir</DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              create.mutate()
            }}
          >
            <DialogHeader>
              <DialogTitle>Novo token</DialogTitle>
              <DialogDescription>
                O token age em seu nome, com o seu papel e os seus acessos.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              {create.isError && !Object.keys(errors).length ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>
                    {errorMessage(create.error)}
                  </AlertDescription>
                </Alert>
              ) : null}
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="token-name">Nome</FieldLabel>
                <Input
                  id="token-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Agente do time de vendas"
                  required
                  autoComplete="off"
                  aria-invalid={errors.name ? true : undefined}
                />
                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="token-expiry">Validade</FieldLabel>
                <SimpleSelect
                  id="token-expiry"
                  items={expiryItems}
                  value={expiry}
                  onValueChange={setExpiry}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Spinner data-icon="inline-start" /> : null}
                Criar token
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
