"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRoundIcon, UserPlusIcon, UsersIcon } from "lucide-react"

import { EmptyState } from "@/components/app-shell/states"
import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/toast"
import { api, errorMessage } from "@/lib/api-client"
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles"

type UserRow = {
  id: string
  name: string
  email: string
  role: Role
  disabled: boolean
  createdAt: string
}

const roleItems = ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient()
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<UserRow[]>("/api/admin/users"),
  })
  const update = useMutation({
    mutationFn: (input: { id: string; role?: Role; disabled?: boolean }) =>
      api(`/api/admin/users/${input.id}`, {
        method: "PATCH",
        body: { role: input.role, disabled: input.disabled },
      }),
    onSuccess: () => {
      toast.add({ title: "Usuário atualizado", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (error) =>
      toast.add({
        title: "Não foi possível atualizar",
        description: errorMessage(error),
        type: "error",
      }),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Só administradores criam contas. O papel define o que cada pessoa pode
          fazer; o acesso a conexões e telas é dado em cada item.
        </p>
        <CreateUserDialog />
      </div>
      {users.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : users.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(users.error)}</AlertDescription>
        </Alert>
      ) : users.data.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum usuário" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                <TableHead className="w-40">Papel</TableHead>
                <TableHead className="w-24">Ativo</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((row) => {
                const self = row.id === currentUserId
                return (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-48">
                      <div className="flex flex-col">
                        <span className="truncate font-medium">
                          {row.name}
                          {self ? (
                            <Badge variant="secondary" className="ml-2">
                              você
                            </Badge>
                          ) : null}
                        </span>
                        <span className="truncate text-xs text-muted-foreground sm:hidden">
                          {row.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-64 truncate sm:table-cell">
                      {row.email}
                    </TableCell>
                    <TableCell>
                      <SimpleSelect
                        aria-label={`Papel de ${row.name}`}
                        items={roleItems}
                        value={row.role}
                        size="sm"
                        disabled={self || update.isPending}
                        onValueChange={(role) =>
                          update.mutate({ id: row.id, role })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`Conta de ${row.name} ativa`}
                        checked={!row.disabled}
                        disabled={self || update.isPending}
                        onCheckedChange={(checked) =>
                          update.mutate({ id: row.id, disabled: !checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <ResetPasswordDialog user={row} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function CreateUserDialog() {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<Role>("viewer")
  const create = useMutation({
    mutationFn: (body: {
      name: string
      email: string
      password: string
      role: Role
    }) => api("/api/admin/users", { method: "POST", body }),
    onSuccess: () => {
      toast.add({ title: "Conta criada", type: "success" })
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      setOpen(false)
    },
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    create.mutate({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      role,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) create.reset()
      }}
    >
      <DialogTrigger render={<Button />}>
        <UserPlusIcon data-icon="inline-start" />
        Novo usuário
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Informe a senha inicial e combine com a pessoa como trocá-la.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {create.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {errorMessage(create.error)}
                </AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="new-user-name">Nome</FieldLabel>
              <Input
                id="new-user-name"
                name="name"
                required
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-user-email">E-mail</FieldLabel>
              <Input
                id="new-user-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-user-password">Senha inicial</FieldLabel>
              <Input
                id="new-user-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-user-role">Papel</FieldLabel>
              <SimpleSelect
                id="new-user-role"
                items={roleItems}
                value={role}
                onValueChange={setRole}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner data-icon="inline-start" /> : null}
              Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user }: { user: UserRow }) {
  const [open, setOpen] = React.useState(false)
  const reset = useMutation({
    mutationFn: (password: string) =>
      api(`/api/admin/users/${user.id}/password`, {
        method: "POST",
        body: { password },
      }),
    onSuccess: () => {
      toast.add({ title: "Senha redefinida", type: "success" })
      setOpen(false)
    },
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset.reset()
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Redefinir senha de ${user.name}`}
          />
        }
      >
        <KeyRoundIcon />
      </DialogTrigger>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            reset.mutate(String(form.get("password")))
          }}
        >
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              {user.name} precisará entrar de novo com a nova senha.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {reset.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(reset.error)}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor={`pw-${user.id}`}>Nova senha</FieldLabel>
              <Input
                id={`pw-${user.id}`}
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={reset.isPending}>
              Redefinir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
