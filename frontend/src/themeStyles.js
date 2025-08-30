// src/themeStyles.js

// ----- Base styles shared across all pages -----
export function getBaseThemeStyles(theme) {
  switch (theme) {
    case "light":
      return {
        sectionBorder: "#ccc",
        sectionBackground: "#fff",
        sectionTextColor: "#111",
        goldTextColor: "#ca9800",
        goldBorderColor: "#ca9800",
        pageBackground: "#f5f5f9"
      };
    case "normal1":
      return {
        sectionBorder: "#facc15",
        sectionBackground: "#1a1a1a",
        sectionTextColor: "#fff",
        goldTextColor: "#facc15",
        goldBorderColor: "#facc15",
        pageBackground: "#0a0f1e"
      };
    case "normal2":
      return {
        sectionBorder: "transparent",
        sectionBackground: "linear-gradient(to bottom, #e53935, #8e24aa 90%)",
        sectionTextColor: "#fff",
        goldTextColor: "#fff",
        goldBorderColor: "#fff",
        pageBackground: "linear-gradient(to bottom, #e53935, #8e24aa 90%)"
      };
    case "dark":
      return {
        sectionBorder: "#00bcd4",
        sectionBackground: "#192332",
        sectionTextColor: "#e8f3fa",
        goldTextColor: "#00ffe1",
        goldBorderColor: "#00ffe1",
        pageBackground: "#0a0f1e"
      };
    case "custom":
      // Placeholder: you can override from ThemeSelector values if you want!
      return {
        sectionBorder: "#444",
        sectionBackground: "#000",
        sectionTextColor: "#fff",
        goldTextColor: "#ff0000",
        goldBorderColor: "#ff0000",
        pageBackground: "#000"
      };
    default:
      return {
        sectionBorder: "#444",
        sectionBackground: "#181818",
        sectionTextColor: "#fff",
        goldTextColor: "#facc15",
        goldBorderColor: "#facc15",
        pageBackground: "#181818"
      };
  }
}

// ----- Core Pages (Home, Profile, Settings, etc.) -----
export function getCoreThemeStyles(theme) {
  const base = getBaseThemeStyles(theme);
  return {
    ...base,
    // Example: Home and Profile get bolder borders in Norm 1, special accent for gold
    sectionBorder: theme === "normal1" ? "#ffe259" : base.sectionBorder,
    sectionTextColor: base.sectionTextColor,
    // Other core-specific tweaks here!
    // goldTextColor: theme === "normal2" ? "#fff" : base.goldTextColor,
  };
}

// ----- Space/Extra Pages (Blog, Events, Store, etc.) -----
export function getSpaceThemeStyles(theme) {
  const base = getBaseThemeStyles(theme);
  return {
    ...base,
    // Example: use different backgrounds or font for space pages
    sectionBackground:
      theme === "normal2"
        ? "linear-gradient(to top, #43cea2, #185a9d 90%)"
        : theme === "dark"
        ? "#091d2c"
        : base.sectionBackground,
    // More space-specific tweaks...
    goldTextColor: theme === "dark" ? "#00ffe1" : base.goldTextColor,
    // Example: maybe more transparent section backgrounds in custom
    sectionBorder: theme === "custom" ? "#ff00e0" : base.sectionBorder
  };
}

// ----- Optional: For single-use/special pages -----
export function getAdminThemeStyles(theme) {
  const base = getBaseThemeStyles(theme);
  return {
    ...base,
    // Customizations for admin if you want
    sectionBackground: "#222",
    goldTextColor: "#e53170"
  };
}
