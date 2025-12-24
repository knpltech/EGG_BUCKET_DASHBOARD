import { createContext, useContext, useState, useEffect } from "react";

const STORAGE_KEY = "egg_damages_v1";
const DamageContext = createContext(null);

export function DamageProvider({ children }) {
  const [damages, setDamages] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // persist damages whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(damages));
  }, [damages]);

  // Add damage by date only if not present (no updates allowed)
  const addDamage = (damage) => {
    const exists = damages.some((d) => d.date === damage.date);
    if (exists) {
      // do not update existing entries
      return false;
    }
    setDamages((prev) => [...prev, damage]);
    return true;
  };

  // Remap all damage entries to match a new set of outlets (fill missing with 0 and recalc totals)
  const remapDamagesForOutlets = (newOutlets) => {
    setDamages((prev) =>
      prev.map((d) => {
        const remapped = { date: d.date };
        newOutlets.forEach((o) => {
          remapped[o] = d[o] ?? 0;
        });
        remapped.total = newOutlets.reduce((s, o) => s + (Number(remapped[o]) || 0), 0);
        return remapped;
      })
    );
  };

  const totalDamages = damages.reduce(
    (sum, d) => sum + (d.total || 0),
    0
  );

  return (
    <DamageContext.Provider
      value={{
        damages,
        addDamage,
        remapDamagesForOutlets,
        totalDamages,
      }}
    >
      {children}
    </DamageContext.Provider>
  );
}

export function useDamage() {
  const context = useContext(DamageContext);

  if (!context) {
    throw new Error(
      "useDamage must be used inside a DamageProvider"
    );
  }

  return context;
}
