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
        language: "Language",
        languageSaveFailed: "Language changed on this device, but your account preference could not be saved.",
        english: "English",
        bangla: "বাংলা",
        navigation: "Main navigation",
        roles: { FARMER: "Farmer", BUYER: "Buyer" },
        nav: {
          dashboard: "Dashboard", myListings: "My Listings", newListing: "New Listing", cropBidding: "Crop Bidding",
          inventory: "Inventory", orders: "Orders", sales: "Sales", earnings: "Earnings", marketPrices: "Market Prices",
          settings: "Settings", marketplace: "Marketplace", compare: "Compare", myBids: "My Bids", watchlist: "Watchlist",
          marketOverview: "Market Overview",
        },
        form: {
          name: "Full name", phone: "Bangladesh mobile number", countryCode: "Country calling code", bangladeshCode: "BD (+880)", password: "Password", division: "Division", district: "District",
          upazilaOptional: "Upazila (optional)", organizationOptional: "Organization (optional)", choose: "Choose one", working: "Please wait…",
        },
        login: {
          title: "Log in", description: "Sign in to continue to your BazarBeat account.", submit: "Log in", noAccount: "New to BazarBeat?",
          createAccount: "Create an account", registered: "Your account is ready. Log in to continue.",
        },
        register: {
          title: "Create account", description: "Join BazarBeat as a farmer or buyer.", role: "I am joining as a", submit: "Create account",
          passwordHint: "At least 8 characters. Common passwords such as 12345678 are not accepted.", haveAccount: "Already have an account?", signIn: "Log in",
        },
        auth: {
          loading: "Checking your session…", loadError: "We could not connect to your account. Check your connection and try again.",
          retry: "Try again", logout: "Log out", pagePlaceholder: "This page will be available in a later marketplace phase.",
          logoutError: "We could not end your session. Check your connection and try again.",
        },
        errors: {
          CONFLICT: "An account with this phone number already exists.", RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
          VALIDATION_ERROR: "Please check your details and try again.", UNAUTHENTICATED: "Your session has ended. Please log in again.",
          INVALID_CREDENTIALS: "Invalid phone number or password. Check your details and try again.",
          NETWORK_ERROR: "We could not reach BazarBeat. Check your connection and try again.", INVALID_PHONE: "Enter a valid Bangladesh mobile number.",
          INVALID_FORM: "Please check the required fields and password rules.",
          INTERNAL: "BazarBeat could not complete that request. Please try again shortly.", API_ERROR: "BazarBeat could not complete that request. Please try again.",
        },
        validation: {
          checkFields: "Please fix the highlighted fields and try again.",
          passwordCommon: "This password is too common. Choose a less predictable password.",
          passwordMin: "Use at least 8 characters.", passwordMax: "Use no more than 128 characters.",
          phoneInvalid: "Enter a valid Bangladesh mobile number, such as 01712345678.",
          nameRequired: "Enter your name.", nameMax: "Use no more than 100 characters.",
          locationRequired: "Choose a division and a district.",
          organizationInvalid: "Organization must be between 1 and 160 characters.",
          upazilaInvalid: "If provided, upazila must be between 1 and 100 characters.",
          fieldInvalid: "Check this field and try again.",
        },
      },
    },
    bn: {
      translation: {
        appName: "বাজারবিট",
        tagline: "ন্যায্য দাম, শক্তিশালী কৃষক",
        introduction: "কৃষক ও ক্রেতাদের মিলিত হওয়ার আরও ন্যায্য উপায়।",
        exploreMarketplace: "বাজার দেখুন",
        marketplacePlaceholder: "বাজার প্রস্তুত করা হচ্ছে।",
        language: "ভাষা",
        languageSaveFailed: "এই ডিভাইসে ভাষা বদলেছে, তবে অ্যাকাউন্টে পছন্দটি সংরক্ষণ করা যায়নি।",
        english: "English",
        bangla: "বাংলা",
        navigation: "প্রধান নেভিগেশন",
        roles: { FARMER: "কৃষক", BUYER: "ক্রেতা" },
        nav: {
          dashboard: "ড্যাশবোর্ড", myListings: "আমার তালিকা", newListing: "নতুন তালিকা", cropBidding: "ফসলের দর",
          inventory: "মজুত", orders: "অর্ডার", sales: "বিক্রয়", earnings: "আয়", marketPrices: "বাজারদর",
          settings: "সেটিংস", marketplace: "বাজার", compare: "তুলনা", myBids: "আমার দর", watchlist: "পছন্দের তালিকা",
          marketOverview: "বাজারের সারাংশ",
        },
        form: {
          name: "পুরো নাম", phone: "বাংলাদেশি মোবাইল নম্বর", countryCode: "দেশের ফোন কোড", bangladeshCode: "বাংলাদেশ (+880)", password: "পাসওয়ার্ড", division: "বিভাগ", district: "জেলা",
          upazilaOptional: "উপজেলা (ঐচ্ছিক)", organizationOptional: "প্রতিষ্ঠান (ঐচ্ছিক)", choose: "একটি নির্বাচন করুন", working: "অপেক্ষা করুন…",
        },
        login: {
          title: "লগ ইন", description: "আপনার বাজারবিট অ্যাকাউন্টে প্রবেশ করুন।", submit: "লগ ইন", noAccount: "বাজারবিটে নতুন?",
          createAccount: "অ্যাকাউন্ট তৈরি করুন", registered: "আপনার অ্যাকাউন্ট তৈরি হয়েছে। চালিয়ে যেতে লগ ইন করুন।",
        },
        register: {
          title: "অ্যাকাউন্ট তৈরি করুন", description: "কৃষক বা ক্রেতা হিসেবে বাজারবিটে যোগ দিন।", role: "আমি যোগ দিচ্ছি", submit: "অ্যাকাউন্ট তৈরি করুন",
          passwordHint: "কমপক্ষে ৮ অক্ষর দিন। 12345678-এর মতো সহজ পাসওয়ার্ড গ্রহণ করা হয় না।", haveAccount: "আগে থেকেই অ্যাকাউন্ট আছে?", signIn: "লগ ইন",
        },
        auth: {
          loading: "আপনার সেশন যাচাই হচ্ছে…", loadError: "অ্যাকাউন্টে সংযোগ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
          retry: "আবার চেষ্টা করুন", logout: "লগ আউট", pagePlaceholder: "বাজারের পরবর্তী ধাপে এই পৃষ্ঠাটি চালু হবে।",
          logoutError: "আপনার সেশন শেষ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
        },
        errors: {
          CONFLICT: "এই নম্বরে ইতিমধ্যে একটি অ্যাকাউন্ট আছে।", RATE_LIMITED: "অনেকবার চেষ্টা হয়েছে। একটু অপেক্ষা করে আবার চেষ্টা করুন।",
          VALIDATION_ERROR: "তথ্য যাচাই করে আবার চেষ্টা করুন।", UNAUTHENTICATED: "আপনার সেশনের মেয়াদ শেষ। আবার লগ ইন করুন।",
          INVALID_CREDENTIALS: "ফোন নম্বর বা পাসওয়ার্ড সঠিক নয়। তথ্য যাচাই করে আবার চেষ্টা করুন।",
          NETWORK_ERROR: "বাজারবিটে সংযোগ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।", INVALID_PHONE: "সঠিক বাংলাদেশি মোবাইল নম্বর দিন।",
          INVALID_FORM: "প্রয়োজনীয় তথ্য ও পাসওয়ার্ডের নিয়ম যাচাই করুন।",
          INTERNAL: "বাজারবিট অনুরোধটি সম্পন্ন করতে পারেনি। কিছুক্ষণ পর আবার চেষ্টা করুন।", API_ERROR: "বাজারবিট অনুরোধটি সম্পন্ন করতে পারেনি। আবার চেষ্টা করুন।",
        },
        validation: {
          checkFields: "চিহ্নিত ঘরগুলো ঠিক করে আবার চেষ্টা করুন।",
          passwordCommon: "এই পাসওয়ার্ডটি খুব সহজ। অনুমান করা কঠিন এমন পাসওয়ার্ড দিন।",
          passwordMin: "কমপক্ষে ৮ অক্ষর ব্যবহার করুন।", passwordMax: "সর্বোচ্চ ১২৮ অক্ষর ব্যবহার করুন।",
          phoneInvalid: "সঠিক বাংলাদেশি মোবাইল নম্বর দিন, যেমন 01712345678।",
          nameRequired: "আপনার নাম লিখুন।", nameMax: "সর্বোচ্চ ১০০ অক্ষর ব্যবহার করুন।",
          locationRequired: "বিভাগ ও জেলা নির্বাচন করুন।",
          organizationInvalid: "প্রতিষ্ঠানের নাম ১ থেকে ১৬০ অক্ষরের মধ্যে হতে হবে।",
          upazilaInvalid: "উপজেলা দিলে ১ থেকে ১০০ অক্ষরের মধ্যে হতে হবে।",
          fieldInvalid: "এই ঘরটি যাচাই করে আবার চেষ্টা করুন।",
        },
      },
    },
  },
  interpolation: { escapeValue: false },
});

export { i18n };
