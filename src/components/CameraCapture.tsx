import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { Icon } from './ui';

/**
 * Phones and tablets open their own camera app from <input capture>. Desktop browsers ignore
 * `capture` and show a file picker, so on those we use this in-app webcam view instead.
 */
export function prefersNativeCamera(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent;
  const uaMobile = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  if (uaMobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobi/i.test(ua)) return true;
  // iPadOS reports itself as a Mac; tell it apart by touch support.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

export function canUseWebcam(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
}

export function CameraCapture({ open, onClose, onCapture, onFallback }: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Called when no camera can be used, so the caller can offer the file picker instead. */
  onFallback: () => void;
}) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const [taken, setTaken] = useState(0);
  const [flash, setFlash] = useState(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setErr('');
    (async () => {
      stop();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setReady(true);
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(all.filter((d) => d.kind === 'videoinput'));
        if (!deviceId) setDeviceId(s.getVideoTracks()[0]?.getSettings().deviceId || '');
      } catch (e) {
        if (cancelled) return;
        const name = (e as DOMException)?.name;
        setErr(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? t('camBlocked', 'Camera permission was blocked. Click the camera / lock icon in the address bar, allow the camera, then try again.')
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? t('camNone', 'No camera was found on this computer.')
              : name === 'NotReadableError'
                ? t('camBusy', 'The camera is being used by another app (Zoom, Teams, etc.). Close it and try again.')
                : t('camFail', 'The camera could not be started.'),
        );
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  useEffect(() => {
    if (!open) { stop(); setTaken(0); setDevices([]); setDeviceId(''); }
  }, [open, stop]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (!blob) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      onCapture(new File([blob], `camera-${stamp}.jpg`, { type: 'image/jpeg' }));
      setTaken((n) => n + 1);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    }, 'image/jpeg', 0.92);
  };

  if (!open) return null;
  // Portal to <body> so a transformed/animated ancestor can't clip the fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 tablet:p-6" onClick={onClose}>
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-maroon-950 text-white shadow-glow animate-rise" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <h2 className="text-lg font-bold">{t('takePhoto', 'Take photo')}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close">
            <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="currentColor" strokeWidth="2" fill="none"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="relative aspect-video bg-black">
          <video ref={video} playsInline muted className="h-full w-full object-contain" />
          {flash && <div className="absolute inset-0 bg-white/70" />}
          {!ready && !err && <div className="absolute inset-0 grid place-items-center text-white/70">{t('camStarting', 'Starting camera… allow access if your browser asks.')}</div>}
          {err && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="max-w-md space-y-4">
                <p>{err}</p>
                <button type="button" className="btn-ghost btn-sm" onClick={() => { onClose(); onFallback(); }}>
                  {t('uploadPhoto', 'Upload from device')}
                </button>
              </div>
            </div>
          )}
          {taken > 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm">
              {taken} {t('camTaken', 'photo(s) added')}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            {devices.length > 1 && (
              <select className="max-w-[16rem] rounded-lg bg-white/10 px-3 py-2 text-sm text-white" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} aria-label="Camera">
                {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId} className="text-black">{d.label || `Camera ${i + 1}`}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-gold" onClick={snap} disabled={!ready}>
              <Icon name="camera" className="w-5 h-5" /> {t('capture', 'Capture')}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>{t('done', 'Done')}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
