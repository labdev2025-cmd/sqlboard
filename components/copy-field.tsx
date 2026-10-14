"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { toast } from "@/components/ui/toast"

/** Read-only value with a copy button (falls back to selecting the text). */
export function CopyField({
  value,
  label,
  id,
}: {
  value: string
  label: string
  id?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  return (
    <InputGroup>
      <InputGroupInput
        ref={inputRef}
        id={id}
        readOnly
        value={value}
        aria-label={label}
        className="font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={
            copied ? `${label} copiado` : `Copiar ${label.toLowerCase()}`
          }
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              toast.add({ title: `${label} copiado`, type: "success" })
            } catch {
              // Without clipboard access (HTTP, permission): select the text
              // so the person can copy it by hand.
              inputRef.current?.select()
              toast.add({
                title: "Não foi possível copiar",
                description: "O texto ficou selecionado: copie com Ctrl+C.",
                type: "error",
              })
            }
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
