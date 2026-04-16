import React, { createContext, useContext, useState, useCallback } from "react";

export type Language = "en" | "sw";

const translations: Record<string, Record<Language, string>> = {
  // Nav & Layout
  "Welcome": { en: "Welcome", sw: "Karibu" },
  "Profile": { en: "Profile", sw: "Wasifu" },
  "Settings": { en: "Settings", sw: "Mipangilio" },
  "Logout": { en: "Logout", sw: "Ondoka" },
  "Collapse": { en: "Collapse", sw: "Kunja" },

  // Sidebar
  "Dashboard": { en: "Dashboard", sw: "Dashibodi" },
  "Verification": { en: "Verification", sw: "Uthibitisho" },
  "Jobs": { en: "Jobs", sw: "Kazi" },
  "Categories": { en: "Categories", sw: "Makundi" },
  "Payments": { en: "Payments", sw: "Malipo" },
  "Disbursements": { en: "Disbursements", sw: "Malipo ya Nje" },
  "Community": { en: "Community", sw: "Jamii" },
  "Reports": { en: "Reports", sw: "Ripoti" },
  "Activity Logs": { en: "Activity Logs", sw: "Kumbukumbu" },
  "User Management": { en: "User Management", sw: "Usimamizi wa Watumiaji" },
  "My Jobs": { en: "My Jobs", sw: "Kazi Zangu" },
  "Earnings": { en: "Earnings", sw: "Mapato" },
  "Reviews": { en: "Reviews", sw: "Maoni" },
  "Post a Job": { en: "Post a Job", sw: "Tuma Kazi" },
  "Find Fundis": { en: "Find Fundis", sw: "Tafuta Fundi" },
  "My Bookings": { en: "My Bookings", sw: "Hifadhi Zangu" },

  // Customer Dashboard
  "Find Skilled Fundis": { en: "Find Skilled Fundis", sw: "Tafuta Mafundi Wenye Ujuzi" },
  "Book trusted professionals near you": { en: "Book trusted professionals near you", sw: "Hifadhi wataalamu wa kuaminika karibu nawe" },
  "What service do you need?": { en: "What service do you need?", sw: "Unahitaji huduma gani?" },
  "Instant Service": { en: "Instant Service", sw: "Huduma ya Haraka" },
  "Request now": { en: "Request now", sw: "Omba sasa" },
  "Schedule": { en: "Schedule", sw: "Ratiba" },
  "Book ahead": { en: "Book ahead", sw: "Hifadhi mapema" },
  "Service Categories": { en: "Service Categories", sw: "Makundi ya Huduma" },
  "Available Fundis": { en: "Available Fundis", sw: "Mafundi Wanaopatikana" },
  "available": { en: "available", sw: "wanaopatikana" },
  "Online": { en: "Online", sw: "Mtandaoni" },
  "Offline": { en: "Offline", sw: "Nje ya Mtandao" },
  "Hire Now": { en: "Hire Now", sw: "Ajiri Sasa" },
  "New": { en: "New", sw: "Mpya" },
  "No fundis available right now. Check back soon!": { en: "No fundis available right now. Check back soon!", sw: "Hakuna fundi kwa sasa. Rudi baadaye!" },
  "Total Spent": { en: "Total Spent", sw: "Jumla Iliyotumika" },
  "Avg. Rating Given": { en: "Avg. Rating Given", sw: "Wastani wa Ukadiriaji" },
  "Map View": { en: "Map View", sw: "Ramani" },
  "Hide Map": { en: "Hide Map", sw: "Ficha Ramani" },
  "Online Fundis Map": { en: "Online Fundis Map", sw: "Ramani ya Mafundi Mtandaoni" },
  "All Categories": { en: "All Categories", sw: "Makundi Yote" },
  "Filter by Category": { en: "Filter by Category", sw: "Chuja kwa Kundi" },

  // Hire Dialog
  "Hire": { en: "Hire", sw: "Ajiri" },
  "Fill in the job details. The fundi will be notified and can accept or reject.": { en: "Fill in the job details. The fundi will be notified and can accept or reject.", sw: "Jaza maelezo ya kazi. Fundi ataarifiwa na anaweza kukubali au kukataa." },
  "Job Title": { en: "Job Title", sw: "Jina la Kazi" },
  "Description": { en: "Description", sw: "Maelezo" },
  "Describe the work needed...": { en: "Describe the work needed...", sw: "Eleza kazi inayohitajika..." },
  "Price (KSH)": { en: "Price (KSH)", sw: "Bei (KSH)" },
  "Category": { en: "Category", sw: "Kundi" },
  "Select": { en: "Select", sw: "Chagua" },
  "Address / Location": { en: "Address / Location", sw: "Anwani / Eneo" },
  "Your Phone Number": { en: "Your Phone Number", sw: "Nambari yako ya Simu" },
  "Cancel": { en: "Cancel", sw: "Ghairi" },
  "Send Hire Request": { en: "Send Hire Request", sw: "Tuma Ombi la Kuajiri" },
  "Sending...": { en: "Sending...", sw: "Inatuma..." },
  "General": { en: "General", sw: "Jumla" },

  // Notifications
  "New Job Posted": { en: "New Job Posted", sw: "Kazi Mpya Imetumwa" },
  "A new job has been posted": { en: "A new job has been posted", sw: "Kazi mpya imetumwa" },
  "Notifications": { en: "Notifications", sw: "Arifa" },
  "Mark all read": { en: "Mark all read", sw: "Soma zote" },
  "No notifications": { en: "No notifications", sw: "Hakuna arifa" },

  // Worker dashboard
  "You are here": { en: "You are here", sw: "Uko hapa" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem("app_language") as Language) || "en";
  });

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("app_language", lang);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[key]?.[language] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
