import React from 'react';
import { Github, Linkedin, Globe, Twitter, Facebook, Sparkles } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const SocialLink: React.FC<{ href: string; 'aria-label': string; children: React.ReactNode }> = ({ href, 'aria-label': ariaLabel, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-brand-600 transition-all duration-200 p-2 hover:bg-brand-50 rounded-full hover:scale-110"
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );

  return (
    <footer className="bg-background/50 border-t backdrop-blur-sm screen-only flex-shrink-0 py-6 mt-auto">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex justify-center md:order-2 gap-1">
            <SocialLink href="#" aria-label="Website"><Globe className="h-5 w-5" /></SocialLink>
            <SocialLink href="#" aria-label="GitHub"><Github className="h-5 w-5" /></SocialLink>
            <SocialLink href="#" aria-label="LinkedIn"><Linkedin className="h-5 w-5" /></SocialLink>
            <SocialLink href="#" aria-label="Twitter"><Twitter className="h-5 w-5" /></SocialLink>
            <SocialLink href="#" aria-label="Facebook"><Facebook className="h-5 w-5" /></SocialLink>
          </div>

          <div className="mt-8 md:mt-0 md:order-1">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                <p className="font-medium">&copy; {currentYear} Limperial Technology Co., Ltd.</p>
                <span className="hidden sm:inline w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles className="w-3.5 h-3.5 text-brand-500 fill-brand-500/20" />
                  <span className="font-semibold text-xs bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-brand-400">Powered by Gemini</span>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground/60 mt-1">
                <a href="#" className="hover:text-foreground transition-colors hover:underline">Privacy Policy</a>
                <span className="text-border">•</span>
                <a href="#" className="hover:text-foreground transition-colors hover:underline">Terms of Service</a>
                <span className="text-border">•</span>
                <span className="font-mono opacity-70">v1.2.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
