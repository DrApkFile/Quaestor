import { formatUnits } from 'viem';
import './windowDialog.css';
export function windowPrompt(operations: number, maxValue: bigint) {
  return `This needs a transaction window: about ${String(operations)} ${operations === 1 ? 'transaction' : 'transactions'}, up to ${formatUnits(maxValue + 100000n, 6)} QOR including fees.`;
}
export function confirmWindow(operations: number, maxValue: bigint): Promise<boolean> {
  const previous = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'window-dialog';
  dialog.setAttribute('aria-labelledby', 'window-dialog-title');
  dialog.setAttribute('aria-describedby', 'window-dialog-body');
  const title = document.createElement('h2');
  title.id = 'window-dialog-title';
  title.textContent = 'Open a transaction window';
  const body = document.createElement('p');
  body.id = 'window-dialog-body';
  body.textContent = windowPrompt(operations, maxValue);
  const actions = document.createElement('div');
  actions.className = 'actions';
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.textContent = 'Open window and continue';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = 'Cancel';
  actions.append(accept, cancel);
  dialog.append(title, body, actions);
  document.body.append(dialog);
  return new Promise((resolve) => {
    const finish = (accepted: boolean) => {
      dialog.close();
      dialog.remove();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      resolve(accepted);
    };
    accept.addEventListener('click', () => {
      finish(true);
    });
    cancel.addEventListener('click', () => {
      finish(false);
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      (document.activeElement === accept ? cancel : accept).focus();
    });
    dialog.showModal();
    cancel.focus();
  });
}
