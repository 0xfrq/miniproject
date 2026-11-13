import './globals.css';
import '../styles/portal.css';
import '../styles/cms.css';

export const metadata = {
  title: 'SDN Bangah No. 383',
  description: 'Platform profil sekolah dan workspace guru SDN Bangah No. 383.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
