import type React from 'react';

export type SvgPngRendererHandle = {
  render: (svgDataUri: string) => Promise<string>;
};

export declare const SvgPngRenderer: React.ForwardRefExoticComponent<
  React.RefAttributes<SvgPngRendererHandle>
>;
