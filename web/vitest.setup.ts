// happy-dom does not always implement <dialog>.showModal() / close(): minimal stand-ins
// (opening and closing are checked through the `open` attribute).
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
