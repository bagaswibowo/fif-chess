import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import "./realtime.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Jev Chess",
  description:
    "Play chess against TypeSafe Jev. Chess.js owns the rules; Jev only picks from legal UCI moves.",
  // V8: PWA-lite — manifest valid (installable), ikon original buatan sendiri.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/app-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/app-icon.svg", type: "image/svg+xml" }],
  },
};

// viewport-fit=cover wajib agar env(safe-area-inset-*) aktif di iPhone
// (notch + home bar) sehingga header & nav bawah tidak tertutup.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c1a18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {/* V8: registrasi service worker (vanilla app/sw.js) — pasca-load, tanpa autoplay. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); }); }`,
          }}
        />
        <div id="offline-banner-root"></div>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  function renderOffline() {
    var root = document.getElementById("offline-banner-root");
    if (!root) return;
    if (navigator.onLine) { root.innerHTML = ""; return; }
    if (root.childElementCount > 0) return;
    var b = document.createElement("div");
    b.className = "offline-banner";
    b.setAttribute("role", "status");
    b.setAttribute("aria-live", "polite");
    b.textContent = "Anda sedang offline — menampilkan shell tersimpan.";
    root.appendChild(b);
  }
  window.addEventListener("offline", renderOffline);
  window.addEventListener("online", renderOffline);
  window.addEventListener("load", renderOffline);
})();`,
          }}
        />
      </body>
    </html>
  );
}
