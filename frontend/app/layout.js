"use client";

import { GeistSans } from "geist/font/sans";
import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";

function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="nav-header">
      <div className="nav-container">
        <Link href="/" className="nav-logo-group">
          <svg className="mongodb-leaf" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12.5 2C12.5 2 7 5.5 7 12C7 18.5 12 22 12 22C12 22 17 18.5 17 12C17 5.5 12.5 2 12.5 2Z" fill="currentColor"/>
            <path d="M12 22C12 22 11.5 20 11.5 17C11.5 14 12 12 12 12C12 12 12.5 14 12.5 17C12.5 20 12 22 12 22Z" fill="currentColor" opacity="0.5"/>
          </svg>
          <div className="nav-logo-text">
            <span className="logo-primary">OmniPay</span>
            <span className="logo-secondary">Powered by MongoDB</span>
          </div>
        </Link>

        <div className="nav-links">
          <Link
            href="/payment-builder"
            className={`nav-link ${pathname === '/payment-builder' ? 'active' : ''}`}
          >
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 8h12" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 11h3M10 11h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Payment Builder</span>
          </Link>
          <Link
            href="/geographic"
            className={`nav-link ${pathname === '/geographic' ? 'active' : ''}`}
          >
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 8H14M8 2C8 2 5 5 5 8C5 11 8 14 8 14M8 2C8 2 11 5 11 8C11 11 8 14 8 14" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span>Network Visualizer</span>
          </Link>
        </div>

        <div className="nav-actions">
          <Link
            href="/documentation"
            className={`nav-button-secondary ${pathname === '/documentation' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Documentation</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body>
        <LeafyGreenProvider>
          <Navigation />
          <main className="main-content">
            {children}
          </main>
        </LeafyGreenProvider>
      </body>
    </html>
  );
}
