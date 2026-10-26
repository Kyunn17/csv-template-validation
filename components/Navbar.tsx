"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

function NavLinks() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isParquet = pathname.startsWith("/parquet");
  const isTemplates = pathname.startsWith("/templates");

  return (
    <>
      <nav className="hidden sm:flex items-center gap-1">
        <Link
          href="/"
          className={`nav-link ${isHome ? "active" : ""}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          CSV Upload
        </Link>

        <Link
          href="/parquet"
          className={`nav-link ${isParquet ? "active" : ""}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          Parquet Upload
        </Link>

        <Link
          href="/templates"
          className={`nav-link ${isTemplates ? "active" : ""}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          Templates
        </Link>
      </nav>

      {/* Mobile nav pills */}
      <div className="flex sm:hidden overflow-x-auto border-t border-slate-100 px-4 py-2 gap-1 bg-slate-50/70">
        <Link
          href="/"
          className={`nav-link text-xs whitespace-nowrap ${isHome ? "active" : ""}`}
        >
          CSV Upload
        </Link>
        <Link
          href="/parquet"
          className={`nav-link text-xs whitespace-nowrap ${isParquet ? "active" : ""}`}
        >
          Parquet
        </Link>
        <Link
          href="/templates"
          className={`nav-link text-xs whitespace-nowrap ${isTemplates ? "active" : ""}`}
        >
          Templates
        </Link>
      </div>
    </>
  );
}

function NavLinksFallback() {
  return (
    <>
      <nav className="hidden sm:flex items-center gap-1">
        <Link href="/" className="nav-link">CSV Upload</Link>
        <Link href="/parquet" className="nav-link">Parquet Upload</Link>
        <Link href="/templates" className="nav-link">Templates</Link>
      </nav>
      <div className="flex sm:hidden overflow-x-auto border-t border-slate-100 px-4 py-2 gap-1 bg-slate-50/70">
        <Link href="/" className="nav-link text-xs">CSV Upload</Link>
        <Link href="/parquet" className="nav-link text-xs">Parquet</Link>
        <Link href="/templates" className="nav-link text-xs">Templates</Link>
      </div>
    </>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 text-decoration-none group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition-transform group-hover:scale-105">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13h8" />
                <path d="M8 17h8" />
                <path d="M10 9h1" />
              </svg>
            </div>
            <div>
              <span className="block text-sm font-bold tracking-tight text-slate-900 leading-none">
                CSV Validator
              </span>
              <span className="block text-[11px] font-medium text-blue-600 mt-0.5 leading-none">
                Databricks Ingest
              </span>
            </div>
          </Link>

          <Suspense fallback={<NavLinksFallback />}>
            <NavLinks />
          </Suspense>
        </div>

        {/* Right CTA / Action */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/templates/new"
            className="btn-primary text-xs"
            style={{ padding: "7px 14px" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Template
          </Link>
        </div>
      </div>
    </header>
  );
}
