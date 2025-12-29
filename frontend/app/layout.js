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
            <span className="logo-primary">Payment Processing</span>
            <span className="logo-secondary">Powered by MongoDB</span>
          </div>
        </Link>

        <div className="nav-links">
          <Link
            href="/agentic-ai"
            className={`nav-link ${pathname === '/agentic-ai' ? 'active' : ''}`}
          >
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L10 6L14 6.5L11 9.5L12 14L8 11.5L4 14L5 9.5L2 6.5L6 6L8 2Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
            </svg>
            <span>Smart Converter</span>
          </Link>
          <Link
            href="/config-builder"
            className={`nav-link ${pathname === '/config-builder' ? 'active' : ''}`}
          >
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3h4v4H3V3zm6 0h4v4H9V3zM3 9h4v4H3V9zm6 0h4v4H9V9z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            <span>Config Studio</span>
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
