export interface SpikeApi {
  cors(address: string): Promise<unknown>;
  crypto(): Promise<unknown>;
  broadcast(tx: string): Promise<unknown>;
}
declare global {
  interface Window {
    quaestorSpike: SpikeApi;
  }
}
