import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: 'Chat • Luan Maciel', robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };
export default function ChatLayout({ children }: { children: React.ReactNode }) { return children; }
