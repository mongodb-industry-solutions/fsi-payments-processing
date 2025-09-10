"use client";

import { GeistSans } from "geist/font/sans";
import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import Link from "next/link";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body>
        <LeafyGreenProvider>
          <nav className="nav-header">
            <div className="nav-container">
              <Link href="/" className="nav-logo">
                <span className="logo-text">Payment Converter</span>
              </Link>
              <div className="nav-links">
                <Link href="/converter" className="nav-link">
                  Converter
                </Link>
                <Link href="/api-docs" className="nav-link">
                  API Docs
                </Link>
              </div>
            </div>
          </nav>
          <main className="main-content">
            {children}
          </main>
        </LeafyGreenProvider>
      </body>
    </html>
  );
}
