import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t py-6 md:py-8 relative bg-background z-50">
      {/* Paper Texture Overlay */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply dark:hidden"
        style={{ backgroundImage: `url('/assets/textures/paper_texture.jpg')`, backgroundSize: 'cover' }}
      />
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 2xl:px-8 md:h-24 2xl:h-32 md:flex-row relative z-10">
        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-2">
          <p className="text-center text-sm 2xl:text-xl leading-loose text-muted-foreground md:text-left">
            © {new Date().getFullYear()} NEMETIX LTD. All rights reserved. <br />
            <span className="text-xs 2xl:text-sm">Registered in England & Wales (No. 16915477). Contact: legal@questr.gg</span>
          </p>
        </div>
        <div className="flex gap-4 2xl:gap-8 text-sm 2xl:text-xl text-muted-foreground">
          <Link href="/legal/terms-of-service" className="hover:underline hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/legal/privacy-policy" className="hover:underline hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/legal/cookie-policy" className="hover:underline hover:text-foreground">
            Cookie Policy
          </Link>

          <Link href="/legal/refund-policy" className="hover:underline hover:text-foreground">
            Refund Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
