import "react";
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "ui-tier": { tier: string; children?: React.ReactNode };
      "ui-note": { title?: string; section?: string; tier?: string; marker?: string; children?: React.ReactNode };
    }
  }
}
