import "./globals.css";
import Nav from "./nav";

export const metadata = {
  title: "CRUD App — PostgreSQL",
  description: "A simple CRUD app with login, registration and PostgreSQL",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
