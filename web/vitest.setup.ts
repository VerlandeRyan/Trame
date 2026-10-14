// happy-dom n'implémente pas toujours <dialog>.showModal() / close() : doublures minimales
// (l'ouverture et la fermeture se vérifient par l'attribut `open`).
if (typeof HTMLDialogElement !== 'undefined') {
  const dialogPrototype = HTMLDialogElement.prototype

  if (!dialogPrototype.showModal) {
    dialogPrototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true
    }
  }

  if (!dialogPrototype.close) {
    dialogPrototype.close = function close(this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
}
