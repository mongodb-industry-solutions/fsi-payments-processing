import { GeistSans } from "geist/font/sans";
import { Providers } from "./providers";
import Navigation from "@/components/Navigation";
import "./globals.css";

export default function RootLayout({ children }) {
  // CI bakes BIAN_MODEL_URL per environment (kaniko build_args). When unset —
  // local `npm run dev` — fall back to the deployed staging explorer so the
  // nav link works without running the bian-model container locally.
  const bianModelUrl =
    process.env.BIAN_MODEL_URL ||
    "https://leafy-bank-bian-model.industrysolutions.staging.corp.mongodb.com";

  return (
    <html lang="en" className={GeistSans.className}>
      <head>
        <title>Agentic Payments Platform</title>
        <link rel="icon" href="/leaf-icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <Providers>
          <Navigation bianModelUrl={bianModelUrl} />
          <main className="main-content">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
