/** Error returned by the sqlboard API, with the server's pt-BR message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}

/** Fetch wrapper for the JSON API used by client components. */
export async function api<T>(
  url: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<T> {
  const { body, headers, ...rest } = init
  let response: Response
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error
    throw new ApiError(0, "Sem conexão com o servidor. Verifique sua rede.")
  }
  const text = await response.text()
  const data = text ? safeJson(text) : null
  if (!response.ok) {
    const message =
      (data as { error?: string } | null)?.error ??
      `Erro ${response.status} ao falar com o servidor.`
    throw new ApiError(
      response.status,
      message,
      (data as { details?: unknown } | null)?.details
    )
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Erro inesperado."
}
