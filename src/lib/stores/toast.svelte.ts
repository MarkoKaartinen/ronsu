class Toast {
  message = $state('');
  kind = $state<'error' | 'info'>('error');
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string, kind: 'error' | 'info' = 'error', ms = 4000) {
    this.message = message;
    this.kind = kind;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.message = ''), ms);
  }

  hide() {
    clearTimeout(this.timer);
    this.message = '';
  }
}

export const toast = new Toast();
