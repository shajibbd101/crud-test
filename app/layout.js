import "./globals.css";

export const metadata = {
  title: "CRUD App — PostgreSQL",
  description: "A simple CRUD app with Next.js API routes and PostgreSQL",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
