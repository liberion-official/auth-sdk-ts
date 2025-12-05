import { default as i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locale/en.json";
import ru from "@/locale/ru.json";

const resources = {
  en: {
    translation: en,
  },
  ru: {
    translation: ru,
  },
};

const getBrowserLanguage = () => {
  const browserLang = navigator.language || navigator.userLanguage;
  return browserLang?.toLowerCase().startsWith("ru") ? "ru" : "en";
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getBrowserLanguage(),
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
