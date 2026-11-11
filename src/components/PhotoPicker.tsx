import { useRef } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './ui';

export interface LocalPhoto { key: string; blob: Blob; url: string }

/** Camera capture (rear camera on phones/tablets) + upload from gallery. Holds photos locally until saved. */
export function PhotoPicker({ photos, onAdd, onRemove }: { photos: LocalPhoto[]; onAdd: (files: File[]) => void; onRemove: (key: string) => void }) {
  const { t } = useI18n();
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onAdd(files);
    e.target.value = '';
  };
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => cam.current?.click()}
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gold-400 bg-gold-100/40 px-4 py-6 text-maroon-800 transition hover:bg-gold-100">
          <span className="grid place-items-center w-12 h-12 rounded-full metal-gold shadow group-hover:scale-105 transition"><Icon name="camera" className="w-6 h-6" /></span>
          <span className="font-semibold">{t('takePhoto', 'Take photo')}</span>
        </button>
        <button type="button" onClick={() => gal.current?.click()}
          className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cream-300 bg-white px-4 py-6 text-charcoal/70 transition hover:bg-cream-50">
          <span className="grid place-items-center w-12 h-12 rounded-full bg-cream-100 group-hover:scale-105 transition"><Icon name="image" className="w-6 h-6" /></span>
          <span className="font-semibold">{t('uploadPhoto', 'Upload from device')}</span>
        </button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={gal} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={pick} />
      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 tablet:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.key} className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-cream-300 animate-rise">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => onRemove(p.key)} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white" aria-label="Remove photo">
                <svg viewBox="0 0 24 24" className="w-4 h-4" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
              <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 text-[10px] text-white">new</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
