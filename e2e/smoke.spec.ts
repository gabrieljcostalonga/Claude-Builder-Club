import { expect, test } from "@playwright/test";

// Smoke tests que não dependem de um Supabase real: rotas públicas, proteção
// de rotas privadas e endpoints protegidos por segredo.

test("raiz e páginas privadas redirecionam para o login", async ({ page }) => {
  for (const path of ["/", "/dashboard", "/transacoes", "/contas"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("login valida senha curta sem chamar o servidor de auth", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("teste@example.com");
  await page.getByLabel("Senha").fill("123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  // validação nativa do HTML impede envio
  await expect(page).toHaveURL(/\/login$/);
});

test("cadastro renderiza e linka para login", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("webhook e cron rejeitam chamadas sem segredo", async ({ request }) => {
  const hook = await request.post("/api/pluggy/webhook", { data: { event: "item/updated", itemId: "x" } });
  expect(hook.status()).toBe(403);
  const hookWrong = await request.post("/api/pluggy/webhook?secret=errado", { data: { event: "item/updated", itemId: "x" } });
  expect(hookWrong.status()).toBe(403);
  const cron = await request.get("/api/cron/sync");
  expect(cron.status()).toBe(403);
});
