import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Globe2 } from 'lucide-react'
import { translations } from './translations'
import './locale.css'

const languages = [
  { id: 'en', label: 'English', tag: 'en-MY' },
  { id: 'ms', label: 'Bahasa Melayu', tag: 'ms-MY' },
  { id: 'zh', label: '简体中文', tag: 'zh-Hans-MY' },
] as const

type Language = typeof languages[number]['id']
type Values = Record<string, string | number>
type Locale = { language: Language; locale: string; setLanguage: (language: Language) => void; t: (message: string, values?: Values) => string }
const preferenceKey = 'seng-guan-auto-language'
const LocaleContext = createContext<Locale | null>(null)

function supported(value: string | null): value is Language {
  return languages.some(({ id }) => id === value)
}

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(preferenceKey)
    if (supported(saved)) return saved
  } catch {
    // Continue with browser preferences when storage is unavailable.
  }

  for (const preference of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const base = preference.toLowerCase().split('-')[0]
    if (supported(base)) return base
  }
  return 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState(initialLanguage)
  const locale = languages.find(({ id }) => id === language)!.tag
  const t = useCallback((message: string, values?: Values) => {
    const entry = Object.hasOwn(translations, message) ? translations[message] : undefined
    const text = entry?.[languages.findIndex(({ id }) => id === language)] ?? message
    return values ? text.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder)) : text
  }, [language])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = 'Seng Guan Auto — ' + t(
      window.location.pathname.replace(/\/$/, '') === '/admin' ? '车辆管理后台' : 'Used Cars in Banting',
    )
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content', t('Explore the Seng Guan Auto car selection, estimate a payment, and plan a visit to Banting.'),
    )
  }, [locale, t])

  const setLanguage = (next: Language) => {
    updateLanguage(next)
    try {
      localStorage.setItem(preferenceKey, next)
    } catch {
      // The selection still applies to this page when storage is unavailable.
    }
  }

  return <LocaleContext.Provider value={{ language, locale, setLanguage, t }}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const locale = useContext(LocaleContext)
  if (!locale) throw new Error('LocaleProvider is required.')
  return locale
}

export function LanguageSelect() {
  const { language, setLanguage, t } = useLocale()
  return (
    <label className="language-select">
      <Globe2 size={16} aria-hidden="true" />
      <span className="language-select-code" aria-hidden="true">{language.toUpperCase()}</span>
      <ChevronDown className="language-select-chevron" size={12} aria-hidden="true" />
      <select aria-label={t('Language')} value={language} onChange={(event) => {
        if (supported(event.target.value)) setLanguage(event.target.value)
      }}>
        {languages.map(({ id, label, tag }) => <option key={id} value={id} lang={tag}>{label}</option>)}
      </select>
    </label>
  )
}
