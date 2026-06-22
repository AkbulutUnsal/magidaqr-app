import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ka from './locales/ka.json'
import en from './locales/en.json'
import tr from './locales/tr.json'
import ru from './locales/ru.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ka: { translation: ka }, en: { translation: en }, tr: { translation: tr }, ru: { translation: ru } },
    fallbackLng: 'ka',
    supportedLngs: ['ka', 'en', 'tr', 'ru'],
    interpolation: { escapeValue: false }
  })

export default i18n
