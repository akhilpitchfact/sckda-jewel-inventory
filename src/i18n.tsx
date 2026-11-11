// Bilingual labels (English / Kannada). The language toggle is remembered per device.
import { createContext, useContext, useState, type ReactNode } from 'react';

const kn: Record<string, string> = {
  appName: 'ಚಿನ್ನ ಮತ್ತು ಬೆಳ್ಳಿ ವಸ್ತುಗಳ ದಾಸ್ತಾನು',
  authority: 'ಶ್ರೀ ಚಾಮುಂಡೇಶ್ವರಿ ಕ್ಷೇತ್ರ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ',
  dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
  newArticle: 'ಹೊಸ ವಸ್ತು ನೋಂದಣಿ',
  inventory: 'ದಾಸ್ತಾನು',
  verification: 'ಪರಿಶೀಲನೆ',
  reports: 'ವರದಿಗಳು',
  auditLog: 'ಲೆಕ್ಕಪರಿಶೋಧನಾ ದಾಖಲೆ',
  users: 'ಬಳಕೆದಾರರು',
  settings: 'ವರ್ಗಗಳು',
  logout: 'ನಿರ್ಗಮಿಸಿ',
  login: 'ಲಾಗಿನ್',
  username: 'ಬಳಕೆದಾರ ಹೆಸರು',
  password: 'ಪಾಸ್‌ವರ್ಡ್',
  gold: 'ಚಿನ್ನ',
  silver: 'ಬೆಳ್ಳಿ',
  hundi: 'ಹುಂಡಿ',
  seva: 'ಸೇವೆ',
  pending: 'ಪರಿಶೀಲನೆ ಬಾಕಿ',
  returned: 'ತಿದ್ದುಪಡಿಗೆ ಹಿಂತಿರುಗಿದೆ',
  approved: 'ಅನುಮೋದಿತ',
  cancelled: 'ರದ್ದು',
  articleId: 'ವಸ್ತು ಸಂಖ್ಯೆ',
  receivedAt: 'ಸ್ವೀಕರಿಸಿದ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ',
  source: 'ಸ್ವೀಕೃತಿ ಮೂಲ',
  receiptRef: 'ಹುಂಡಿ ತಂಡ / ಸೇವಾ ರಸೀದಿ ಸಂಖ್ಯೆ',
  donor: 'ದಾನಿ',
  donorName: 'ದಾನಿಯ ಹೆಸರು',
  donorMobile: 'ದಾನಿಯ ಮೊಬೈಲ್',
  donorAddress: 'ದಾನಿಯ ವಿಳಾಸ',
  metal: 'ಲೋಹ',
  category: 'ವರ್ಗ',
  articleType: 'ವಸ್ತುವಿನ ಪ್ರಕಾರ',
  description: 'ವಿವರಣೆ',
  quantity: 'ಸಂಖ್ಯೆ',
  grossWeight: 'ಒಟ್ಟು ತೂಕ (ಗ್ರಾಂ)',
  netWeight: 'ನಿವ್ವಳ ತೂಕ (ಗ್ರಾಂ)',
  purity: 'ಶುದ್ಧತೆ',
  remarks: 'ಷರಾ',
  weighedBy: 'ತೂಕ ಮಾಡಿದ ಅಧಿಕಾರಿ',
  photos: 'ಛಾಯಾಚಿತ್ರಗಳು',
  takePhoto: 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
  uploadPhoto: 'ಫೋಟೋ ಅಪ್‌ಲೋಡ್',
  capture: 'ಸೆರೆಹಿಡಿಯಿರಿ',
  done: 'ಮುಗಿದಿದೆ',
  camTaken: 'ಫೋಟೋ ಸೇರಿಸಲಾಗಿದೆ',
  camStarting: 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ… ಬ್ರೌಸರ್ ಕೇಳಿದರೆ ಅನುಮತಿ ನೀಡಿ.',
  camBlocked: 'ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ. ವಿಳಾಸ ಪಟ್ಟಿಯಲ್ಲಿನ ಕ್ಯಾಮೆರಾ / ಲಾಕ್ ಐಕಾನ್ ಕ್ಲಿಕ್ ಮಾಡಿ, ಕ್ಯಾಮೆರಾ ಅನುಮತಿಸಿ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  camNone: 'ಈ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಕ್ಯಾಮೆರಾ ಕಂಡುಬಂದಿಲ್ಲ.',
  camBusy: 'ಕ್ಯಾಮೆರಾವನ್ನು ಇನ್ನೊಂದು ಆ್ಯಪ್ ಬಳಸುತ್ತಿದೆ (Zoom, Teams ಇತ್ಯಾದಿ). ಅದನ್ನು ಮುಚ್ಚಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  camFail: 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.',
  save: 'ಉಳಿಸಿ',
  submitForVerification: 'ಪರಿಶೀಲನೆಗೆ ಸಲ್ಲಿಸಿ',
  approve: 'ಅನುಮೋದಿಸಿ',
  returnForCorrection: 'ತಿದ್ದುಪಡಿಗೆ ಹಿಂತಿರುಗಿಸಿ',
  totalGold: 'ಒಟ್ಟು ಚಿನ್ನ',
  totalSilver: 'ಒಟ್ಟು ಬೆಳ್ಳಿ',
  articles: 'ವಸ್ತುಗಳು',
  pieces: 'ತುಣುಕುಗಳು',
  entries: 'ದಾಖಲೆಗಳು',
  pendingVerification: 'ಪರಿಶೀಲನೆ ಬಾಕಿ',
  approvedArticles: 'ಅನುಮೋದಿತ ವಸ್ತುಗಳು',
  today: 'ಇಂದು',
  search: 'ಹುಡುಕಿ',
  from: 'ಇಂದ',
  to: 'ವರೆಗೆ',
  all: 'ಎಲ್ಲಾ',
  status: 'ಸ್ಥಿತಿ',
  history: 'ಇತಿಹಾಸ',
  individualWeights: 'ಪ್ರತ್ಯೇಕ ತೂಕಗಳು',
  hundiCollections: 'ಹುಂಡಿ ಸಂಗ್ರಹ',
  sevaCollections: 'ಸೇವಾ ಸಂಗ್ರಹ',
  receiptsOverTime: 'ತಿಂಗಳವಾರು ಸ್ವೀಕೃತಿ',
  recentEntries: 'ಇತ್ತೀಚಿನ ನೋಂದಣಿಗಳು',
  byCategory: 'ವರ್ಗವಾರು ದಾಸ್ತಾನು',
  downloadPdf: 'PDF ಡೌನ್‌ಲೋಡ್',
  downloadExcel: 'Excel ಡೌನ್‌ಲೋಡ್',
  print: 'ಮುದ್ರಿಸಿ',
};

type Lang = 'en' | 'kn';
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('sckda_jewel_lang') as Lang) || 'en'; } catch { return 'en'; }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('sckda_jewel_lang', l); } catch { /* private mode */ }
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const { lang, setLang } = useContext(Ctx);
  /** t(key, english) — English is passed inline so screens read naturally; Kannada comes from the table. */
  const t = (key: string, en: string) => (lang === 'kn' && kn[key] ? kn[key] : en);
  /** Both languages, for headings: Kannada small above English, as on the Hundi app. */
  const both = (key: string) => kn[key];
  return { lang, setLang, t, both };
}
