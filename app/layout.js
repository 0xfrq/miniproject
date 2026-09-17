import './globals.css';

export const metadata = {
  title: 'SDN Bangah No. 383',
  description: 'Platform profil sekolah dan workspace guru SDN Bangah No. 383.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
