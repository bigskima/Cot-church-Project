import React, { forwardRef, useImperativeHandle } from 'react';

export type SvgPngRendererHandle = {
  render: (svgDataUri: string) => Promise<string>;
};

export const SvgPngRenderer = forwardRef<SvgPngRendererHandle>(function SvgPngRenderer(_, ref) {
  useImperativeHandle(ref, () => ({
    async render() {
      throw new Error('The native Scripture card renderer is unavailable on web.');
    },
  }), []);
  return null;
});
