import { expect, test } from '@playwright/test'

test('l\'en-tête présente la recherche et la connexion', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')
  await expect(header).toContainText('Rechercher une œuvre, un auteur…')
  await expect(header.getByRole('button', { name: 'Se connecter' })).toBeVisible()
})

test('« Se connecter » est le bouton bleu de l\'en-tête', async ({ page }) => {
  await page.goto('/')
  const signIn = page.getByRole('banner').getByRole('button', { name: 'Se connecter' })
  await expect(signIn).toHaveCSS('background-color', 'rgb(35, 64, 184)')
  await expect(signIn).toHaveCSS('color', 'rgb(255, 255, 255)')
})

test('le lien d\'évitement mène au contenu', async ({ page }) => {
  await page.goto('/')
  const skipLink = page.getByRole('link', { name: 'Aller au contenu' })
  await skipLink.focus()
  await expect(skipLink).toBeVisible()
  await skipLink.press('Enter')
  await expect(page).toHaveURL(/#contenu$/)
})

test('pas de défilement horizontal de la page', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
