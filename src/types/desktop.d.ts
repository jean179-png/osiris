export {};

declare global {
  interface Window {
    osirisDesktop?: { isDesktop: true };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          allowpopups?: string | boolean;
          partition?: string;
          useragent?: string;
        },
        HTMLElement
      >;
    }
  }
}
