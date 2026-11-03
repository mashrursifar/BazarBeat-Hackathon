import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
  fallbackLng: "en",
  lng: "en",
  resources: {
    en: {
      translation: {
        appName: "BazarBeat",
        tagline: "Better price. Stronger farmer.",
        introduction: "A fairer way for farmers and buyers to meet.",
        exploreMarketplace: "Explore marketplace",
        marketplacePlaceholder: "Marketplace is getting ready.",
      },
    },
    bn: {
      translation: {
        appName: "বাজারবিট",
        tagline: "ন্যায্য দাম, শক্তিশালী কৃষক",
        introduction: "কৃষক ও ক্রেতাদের মিলিত হওয়ার আরও ন্যায্য উপায়।",
        exploreMarketplace: "বাজার দেখুন",
        marketplacePlaceholder: "বাজার প্রস্তুত করা হচ্ছে।",
      },
    },
  },
  interpolation: { escapeValue: false },
});

export { i18n };
