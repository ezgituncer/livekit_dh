import { Chakra_Petch, Public_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { SceneBackground } from '@/components/app/scene-background';
import { ThemeProvider } from '@/components/app/theme-provider';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { cn } from '@/lib/shadcn/utils';
import { getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

// HUD / sci-fi display font used for the status badge and accent labels.
const chakraPetch = Chakra_Petch({
  variable: '--font-chakra',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

const commitMono = localFont({
  display: 'swap',
  variable: '--font-commit-mono',
  src: [
    {
      path: '../fonts/CommitMono-400-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-700-Regular.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-400-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/CommitMono-700-Italic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const styles = getStyles(appConfig);
  const { pageTitle, pageDescription } = appConfig;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        publicSans.variable,
        commitMono.variable,
        chakraPetch.variable,
        'scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className="overflow-x-hidden">
        <ThemeProvider
          attribute="class"
          forcedTheme="dark"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SceneBackground />
          {/* Huawei logo (top-left), transparent — just the logo, no badge/chip.
              Wordmark is white and the flower keeps its original red. */}
          <div className="fixed top-5 left-6 z-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt={appConfig.companyName} className="block h-9 w-auto" />
          </div>
          {children}
          <footer className="font-chakra pointer-events-none fixed inset-x-0 bottom-2 z-30 text-center text-[10px] tracking-[0.12em] text-white/35">
            ©2026 Huawei Device Co., Ltd. Bütün hakları saklıdır.
          </footer>
          <div className="group fixed bottom-0 left-1/2 z-50 mb-2 -translate-x-1/2">
            <ThemeToggle className="translate-y-20 transition-transform delay-150 duration-300 group-hover:translate-y-0" />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
