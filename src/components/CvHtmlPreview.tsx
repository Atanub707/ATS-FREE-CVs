import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TemplateId } from '../types';
import { renderCvHtml, CV_GEOMETRY, CvRenderShape } from '../lib/cvHtml';

interface CvHtmlPreviewProps {
  cv: CvRenderShape;
  template?: TemplateId;
  zoom?: number;
  onPageCount?: (n: number) => void;
  fitToWidth?: boolean;
}

/**
 * Renders the EXACT HTML the server prints to PDF (renderCvHtml), so the
 * preview and the downloaded PDF are identical A-to-Z.
 */
export const CvHtmlPreview: React.FC<CvHtmlPreviewProps> = ({
  cv,
  template = 'harvard',
  zoom = 100,
  onPageCount,
  fitToWidth = false,
}) => {
  const safeTemplate: TemplateId =
    template === 'jake' || template === 'atanu' || template === 'harvard' ? template : 'harvard';
  const html = useMemo(() => renderCvHtml(cv, safeTemplate), [cv, safeTemplate]);
  const geom = CV_GEOMETRY[safeTemplate] || CV_GEOMETRY.harvard;

  const [fitZoom, setFitZoom] = useState<number>(zoom);
  const rootRef = useRef<HTMLDivElement>(null);
  const measRef = useRef<HTMLDivElement>(null);

  // Auto-fit: scale to fill the container width (up to 100%).
  useEffect(() => {
    if (!fitToWidth) {
      setFitZoom(zoom);
      return;
    }
    const el = rootRef.current?.parentElement;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        const z = Math.min(100, Math.floor(((w - 16) / 612) * 100 / 5) * 5);
        setFitZoom(Math.max(40, z));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToWidth, zoom]);

  // Report the natural page count (matches Chrome's @page pagination).
  useEffect(() => {
    const el = measRef.current;
    if (!el) return;
    const h = el.scrollHeight;
    const usable = 792 - geom.marginY * 2;
    onPageCount?.(Math.max(1, Math.ceil(h / usable)));
  }, [html, onPageCount, geom.marginY]);

  const pageStyle: React.CSSProperties = {
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
    width: 612,
    margin: '0 auto',
    padding: `${geom.marginY}px ${geom.marginX}px`,
    overflow: 'hidden',
  };

  return (
    <div className="flex flex-col items-center w-full" style={{ zoom: fitZoom / 100 }}>
      {/* Hidden measurer at natural size */}
      <div
        ref={measRef}
        aria-hidden
        style={{ position: 'absolute', left: -99999, top: 0, width: 612, visibility: 'hidden', pointerEvents: 'none' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div ref={rootRef} style={pageStyle} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};
