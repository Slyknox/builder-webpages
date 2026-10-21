// Nonce CSP: every response needs a fresh nonce, so pages cannot be prerendered
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#050505', color: '#eee', fontFamily: 'system-ui' }}>{children}</body>
    </html>
  );
}
