import type { Page } from "@playwright/test"

/** Replaces the CodeMirror content (insertText avoids autocomplete popups). */
export async function setSql(page: Page, sql: string, nth = 0) {
  const editor = page.locator(".cm-content").nth(nth)
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await page.keyboard.insertText(sql)
}
