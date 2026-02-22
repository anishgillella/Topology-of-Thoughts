import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Topology of Thoughts",
  description: "3D knowledge graph with topological data analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
