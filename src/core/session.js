import { checkedFen, snapshotKey } from './position.js';

export class Session {
  revision = 0;
  snapshot = null;
  controller = null;
  update(snapshot) {
    if (snapshot?.fen) snapshot = { ...snapshot, fen: checkedFen(snapshot.fen) };
    if (snapshotKey(snapshot || {}) === snapshotKey(this.snapshot || {})) return false;
    this.cancel();
    this.snapshot = snapshot;
    this.revision += 1;
    return true;
  }
  request() {
    this.cancel();
    this.controller = new AbortController();
    return { revision: this.revision, fen: this.snapshot?.fen, signal: this.controller.signal };
  }
  current(request) { return !request.signal.aborted && request.revision === this.revision && request.fen === this.snapshot?.fen; }
  cancel() { this.controller?.abort(); this.controller = null; }
}
