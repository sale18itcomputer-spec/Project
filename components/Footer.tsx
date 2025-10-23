import React from 'react';
import { Github, Linkedin, Globe, Twitter, Facebook, Sparkles } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const SocialLink: React.FC<{ href: string; 'aria-label': string; children: React.ReactNode }> = ({ href, 'aria-label': ariaLabel, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-primary transition-colors"
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );

  return (
    <footer className="bg-card border-t screen-only flex-shrink-0">
      <div className="mx-auto max-w-screen-xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="flex flex-col items-center sm:flex-row sm:items-center gap-x-4 gap-y-2 text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              &copy; {currentYear} Limperial Technology Co., Ltd.
            </p>
            <div className="hidden sm:block h-4 w-px bg-border"></div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-brand-500" />
                <span>Powered by Gemini</span>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-6 sm:mt-0 sm:justify-start">
            <SocialLink href="#" aria-label="Website"><Globe className="h-5 w-5" /></SocialLink>
            <SocialLink href="#" aria-label="GitHub"><Github className="h-5 w-5" /></SocialLink>
            <SocialLink href="#" aria-label="LinkedIn"><Linkedin className="h-5 w-5" /></SocialLink>
            <SocialLink href="#" aria-label="Twitter"><Twitter className="h-5 w-5" /></SocialLink>
            <SocialLink href="#" aria-label="Facebook"><Facebook className="h-5 w-5" /></SocialLink>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
