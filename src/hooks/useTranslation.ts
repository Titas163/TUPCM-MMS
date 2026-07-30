import { useAppStore } from '../store';
import { en } from '../locales/en';
import { bn } from '../locales/bn';

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  const t = language === 'en' ? en : bn;
  return { t, language };
}
