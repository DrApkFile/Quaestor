import { Buffer } from 'buffer';
Object.assign(globalThis, { Buffer });
const [{ createRoot }, { App }] = await Promise.all([import('react-dom/client'), import('./App.js')]);
const root = document.getElementById('root');
if (!root) throw new Error('ROOT_REQUIRED');
createRoot(root).render(<App />);
