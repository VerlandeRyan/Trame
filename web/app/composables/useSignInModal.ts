/** Open state of the sign-in window, shared between the header, the home page and the window. */
export function useSignInModal() {
  return useState('sign-in-modal-open', () => false)
}
