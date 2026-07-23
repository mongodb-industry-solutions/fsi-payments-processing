"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";

export default function Navigation({ bianModelUrl }) {
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
            <span className="logo-primary">Agentic Payments Platform</span>
            <span className="logo-secondary">Powered by MongoDB</span>
          </div>
        </Link>

        <div className="nav-links">
          <Link
            href="/agentic-ai"
            className={`nav-link ${pathname === '/agentic-ai' ? 'active' : ''}`}
          >
            <svg className="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L9 6L14 7L9 8L8 13L7 8L2 7L7 6L8 1Z" fill="currentColor"/>
              <path d="M12 2L12.5 4L14.5 4.5L12.5 5L12 7L11.5 5L9.5 4.5L11.5 4L12 2Z" fill="currentColor" opacity="0.6"/>
              <path d="M4 10L4.5 11.5L6 12L4.5 12.5L4 14L3.5 12.5L2 12L3.5 11.5L4 10Z" fill="currentColor" opacity="0.6"/>
            </svg>
            <span>Smart Processor</span>
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
          <a
            href={`${bianModelUrl}/bian-data-model?demo=payments`}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-button-secondary"
            aria-label="BIAN Data Model"
            title="BIAN Data Model"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 4C6.5 3 4.5 3 2.5 3.5v9c2-0.5 4-0.5 5.5 0.5 1.5-1 3.5-1 5.5-0.5v-9C11.5 3 9.5 3 8 4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
              <path d="M8 4v9" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span>Data Model</span>
          </a>
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
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}
