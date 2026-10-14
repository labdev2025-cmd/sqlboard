export const ROLES = ["admin", "editor", "viewer"] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Leitor",
}

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  )
}

/** Editors and admins build queries and screens; viewers only use them. */
export function canEdit(role: Role): boolean {
  return role === "admin" || role === "editor"
}
