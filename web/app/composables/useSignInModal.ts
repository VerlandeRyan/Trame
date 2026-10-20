/** Ouverture de la fenêtre de connexion, partagée entre l'en-tête, l'accueil et la fenêtre. */
export function useSignInModal() {
  return useState('sign-in-modal-open', () => false)
}
