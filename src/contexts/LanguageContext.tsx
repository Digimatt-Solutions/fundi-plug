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
  "Hire Directly": { en: "Hire Directly", sw: "Ajiri Moja kwa Moja" },
  "Describe it, fundis apply": { en: "Describe it, fundis apply", sw: "Ieleze, mafundi waombe" },
  "Pick a fundi yourself": { en: "Pick a fundi yourself", sw: "Chagua fundi mwenyewe" },

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
  "Fundi Dashboard": { en: "Fundi Dashboard", sw: "Dashibodi ya Fundi" },
  "Manage your jobs and availability": { en: "Manage your jobs and availability", sw: "Simamia kazi zako na upatikanaji" },
  "Total Earnings": { en: "Total Earnings", sw: "Mapato Yote" },
  "Jobs Completed": { en: "Jobs Completed", sw: "Kazi Zilizokamilika" },
  "Average Rating": { en: "Average Rating", sw: "Wastani wa Ukadiriaji" },
  "Pending Jobs": { en: "Pending Jobs", sw: "Kazi Zinazosubiri" },
  "Weekly Earnings": { en: "Weekly Earnings", sw: "Mapato ya Wiki" },
  "Recent Jobs": { en: "Recent Jobs", sw: "Kazi za Hivi Karibuni" },
  "Client": { en: "Client", sw: "Mteja" },
  "No jobs yet - set yourself online to start receiving requests": { en: "No jobs yet - set yourself online to start receiving requests", sw: "Hakuna kazi bado - jiweke mtandaoni kuanza kupokea maombi" },

  // Find Fundis page
  "Browse verified": { en: "Browse verified", sw: "Vinjari walioidhinishwa" },
  "Browse verified skilled professionals": { en: "Browse verified skilled professionals", sw: "Vinjari wataalamu walioidhinishwa" },
  "Search by name or skill...": { en: "Search by name or skill...", sw: "Tafuta kwa jina au ujuzi..." },
  "No fundis found": { en: "No fundis found", sw: "Hakuna fundi aliyepatikana" },
  "Try a different search term": { en: "Try a different search term", sw: "Jaribu neno lingine la utafutaji" },
  "Rating": { en: "Rating", sw: "Ukadiriaji" },
  "Years Exp.": { en: "Years Exp.", sw: "Miaka ya Uzoefu" },
  "Per Hour": { en: "Per Hour", sw: "Kwa Saa" },
  "About": { en: "About", sw: "Kuhusu" },
  "Certifications": { en: "Certifications", sw: "Vyeti" },
  "Customer Reviews": { en: "Customer Reviews", sw: "Maoni ya Wateja" },
  "View": { en: "View", sw: "Tazama" },
  "Hire This Fundi": { en: "Hire This Fundi", sw: "Ajiri Fundi Huyu" },
  "Job Title *": { en: "Job Title *", sw: "Jina la Kazi *" },
  "Price (KSH) *": { en: "Price (KSH) *", sw: "Bei (KSH) *" },
  "Hire request sent!": { en: "Hire request sent!", sw: "Ombi la kuajiri limetumwa!" },
  "Failed to hire": { en: "Failed to hire", sw: "Imeshindwa kuajiri" },
  "Please fill in job title and price": { en: "Please fill in job title and price", sw: "Tafadhali jaza jina la kazi na bei" },
  "Phone": { en: "Phone", sw: "Simu" },
  "Email": { en: "Email", sw: "Barua pepe" },
  "Location": { en: "Location", sw: "Eneo" },
  "Service Area": { en: "Service Area", sw: "Eneo la Huduma" },
  "Skills": { en: "Skills", sw: "Ujuzi" },
  "Verified": { en: "Verified", sw: "Imethibitishwa" },
  "Distance": { en: "Distance", sw: "Umbali" },
  "Status": { en: "Status", sw: "Hali" },
  "County": { en: "County", sw: "Kaunti" },
  "Constituency": { en: "Constituency", sw: "Eneo Bunge" },
  "Ward": { en: "Ward", sw: "Wadi" },
  "Bio": { en: "Bio", sw: "Wasifu" },
  "Group by Category": { en: "Group by Category", sw: "Panga kwa Kundi" },
  "No fundis in this category yet": { en: "No fundis in this category yet", sw: "Hakuna fundi katika kundi hili" },
  "Live Location": { en: "Live Location", sw: "Eneo la Moja kwa Moja" },

  // Customer extra
  "Hire Request Sent": { en: "Hire Request Sent", sw: "Ombi la Kuajiri Limetumwa" },
  "will be notified to accept or reject.": { en: "will be notified to accept or reject.", sw: "ataarifiwa kukubali au kukataa." },
  "Bookings": { en: "Bookings", sw: "Hifadhi" },

  // Settings
  "Preferences": { en: "Preferences", sw: "Mapendeleo" },
  "Sound Alerts": { en: "Sound Alerts", sw: "Sauti za Arifa" },
  "Refresh Site": { en: "Refresh Site", sw: "Onyesha Upya Tovuti" },
  "Language": { en: "Language", sw: "Lugha" },
  "English": { en: "English", sw: "Kiingereza" },
  "Swahili": { en: "Swahili", sw: "Kiswahili" },
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
