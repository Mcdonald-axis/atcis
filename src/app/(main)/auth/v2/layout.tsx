import type { ReactNode } from "react";

import { APP_CONFIG } from "@/config/app-config";

import styles from "./layout.module.css";

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <aside
          className={`relative order-2 hidden h-full overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm lg:flex ${styles.panel}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/[0.05]" />
          <div
            className={`pointer-events-none absolute top-1/3 -right-16 size-80 rounded-full ${styles.ambientGlow}`}
          />
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent ${styles.sheen}`}
          />
          <div
            className={`pointer-events-none absolute top-12 right-12 size-40 rounded-full border border-border/50 ${styles.orbitLarge}`}
          />
          <div
            className={`pointer-events-none absolute top-24 right-24 size-16 rounded-full border border-primary/15 ${styles.orbitSmall}`}
          />

          <div className="relative z-10 flex h-full w-full flex-col p-10 xl:p-12">
            <div className={`border-border/60 border-b pb-6 ${styles.revealBrand}`}>
              <h1 className="font-semibold text-foreground tracking-tight">{APP_CONFIG.name}</h1>
              <p className="mt-1 text-muted-foreground text-xs">Procurement Intelligence Platform</p>
            </div>

            <div className="my-auto max-w-xl py-12">
              <p className={`mb-5 font-medium text-primary text-xs uppercase tracking-[0.2em] ${styles.revealEyebrow}`}>
                Enterprise workspace
              </p>
              <h2
                className={`max-w-lg font-semibold text-4xl text-foreground leading-[1.12] tracking-tight xl:text-5xl ${styles.revealHeading}`}
              >
                Tender intelligence, without the noise.
              </h2>
              <p className={`mt-5 max-w-lg text-muted-foreground text-sm leading-6 ${styles.revealBody}`}>
                A focused workspace for discovering opportunities, coordinating reviews, and managing procurement
                delivery with clarity.
              </p>
              <div className={`mt-8 max-w-md border-primary/50 border-l-2 pl-4 ${styles.revealStatement}`}>
                <p className="text-foreground/80 text-sm leading-6">
                  Structured information. Accountable workflows. Better decisions.
                </p>
              </div>
            </div>

            <div
              className={`flex items-center justify-between gap-4 border-border/60 border-t pt-6 text-muted-foreground text-xs ${styles.revealFooter}`}
            >
              <span>Automated Tender Capture &amp; Intelligence System</span>
              <span className="shrink-0 font-mono">Enterprise v{APP_CONFIG.version}</span>
            </div>
          </div>
        </aside>
        <div className="relative order-1 flex h-full">{children}</div>
      </div>
    </main>
  );
}
