import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/ui/site-footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-foreground bg-background selection:bg-primary/20 flex flex-col relative">
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40 mix-blend-multiply"
        style={{ backgroundImage: `url('/assets/textures/paper_texture.jpg')`, backgroundSize: 'cover' }}
      />

      <header className="sticky top-0 left-0 right-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm shadow-sm transition-all support-backdrop-blur:bg-background/60">
        <div className="container mx-auto flex h-16 lg:h-14 2xl:h-20 items-center justify-between px-4 2xl:px-8">
          <Link href="/" className="flex items-center">
            <div className="flex items-center justify-center">
              <span className="text-3xl lg:text-2xl 2xl:text-4xl font-bold mt-1 tracking-widest" style={{
                fontFamily: 'var(--font-medieval-sharp)',
                color: 'var(--primary)',
                WebkitTextStroke: '1.2px var(--primary)',
                textShadow: '0 0 2px black'
              }}>QUESTR</span>
            </div>
          </Link>
          <div className="flex items-center gap-6 lg:gap-6 2xl:gap-12">
            <Link href="/login">
              <Button className="bg-primary text-white hover:brightness-110 shadow-md rounded-full px-6 py-4 lg:px-5 lg:py-3 2xl:px-8 2xl:py-6 text-lg lg:text-base 2xl:text-xl font-bold">Log in</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-12 md:py-20 px-4 max-w-4xl relative z-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
