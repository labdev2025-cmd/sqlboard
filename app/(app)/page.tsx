import type { Metadata } from "next"
import Link from "next/link"
import {
  BotIcon,
  DatabaseIcon,
  FileCode2Icon,
  LayoutDashboardIcon,
  type LucideIcon,
} from "lucide-react"

import { PageBody, PageHeader } from "@/components/app-shell/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { canEdit } from "@/lib/auth/roles"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Início" }

type Shortcut = {
  href: string
  title: string
  description: string
  icon: LucideIcon
}

export default async function HomePage() {
  const user = await requireUser()
  const shortcuts: Shortcut[] = [
    {
      href: "/apps",
      title: "Telas",
      description: "Painéis e ferramentas montados a partir de queries.",
      icon: LayoutDashboardIcon,
    },
    ...(canEdit(user.role)
      ? [
          {
            href: "/queries",
            title: "Queries",
            description: "Escreva SQL; os parâmetros viram campos.",
            icon: FileCode2Icon,
          },
          {
            href: "/connections",
            title: "Conexões",
            description: "Bancos que a equipe pode consultar.",
            icon: DatabaseIcon,
          },
          {
            href: "/ai",
            title: "Conectar IA",
            description:
              "Peça ao Claude, Codex ou Cursor para criar queries e telas.",
            icon: BotIcon,
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} />
      <PageBody>
        {canEdit(user.role) ? (
          <Card>
            <CardHeader>
              <CardTitle>Como funciona</CardTitle>
              <CardDescription>
                O sqlboard transforma consultas SQL em telas que a equipe usa
                sem precisar saber SQL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
                <li>
                  <strong>Conexão:</strong> um administrador cadastra o banco
                  (de preferência com um usuário só de leitura).
                </li>
                <li>
                  <strong>Query:</strong> você escreve um SELECT; cada{" "}
                  <code>:parametro</code> vira um campo de filtro.
                </li>
                <li>
                  <strong>Tela:</strong> arraste tabelas, gráficos, KPIs e
                  filtros ligados à query, ou use “Gerar tela automática”.
                </li>
                <li>
                  <strong>Publicar:</strong> quem tem acesso usa a tela pronta,
                  só preenchendo os filtros e exportando os dados.
                </li>
              </ol>
              <p className="mt-3 text-sm text-muted-foreground">
                Prefere pedir em português? Em <strong>Conectar IA</strong>, uma
                IA faz esses passos por você e você acompanha ao vivo.
              </p>
            </CardContent>
          </Card>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Escolha por onde começar.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <item.icon
                    className="size-5 text-muted-foreground"
                    aria-hidden
                  />
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </PageBody>
    </>
  )
}
