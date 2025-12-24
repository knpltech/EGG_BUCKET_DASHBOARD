import React from 'react';
import Dailyheader from '../components/Dailyheader';
import DailyTable from '../components/DailyTable';
import Dailyentryform from '../components/Dailyentryform';
import Weeklytrend from '../components/Weeklytrend';
import { useState, useEffect } from 'react';

const DEFAULT_OUTLETS = [
  "AECS Layout",
  "Bandepalya",
  "Hosa Road",
  "Singasandra",
  "Kudlu Gate",
];
const STORAGE_KEY = "egg_outlets_v1";

const Dailysales = () => {
  const [rows, setRows] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [outlets, setOutlets] = useState(DEFAULT_OUTLETS);

  useEffect(() => {
    const savedDate = localStorage.getItem("dailySales");
    if (savedDate) setRows(JSON.parse(savedDate));
    setIsLoaded(true);

    const loadOutletsFromLocal = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedOutlets = JSON.parse(saved);
        const outletAreas = savedOutlets.map((o) => o.area);
        const required = DEFAULT_OUTLETS;
        const hasAllRequired = required.every((r) => outletAreas.includes(r));
        setOutlets(hasAllRequired ? outletAreas : DEFAULT_OUTLETS);
      } else {
        setOutlets(DEFAULT_OUTLETS);
      }
    };

    loadOutletsFromLocal();

    const onUpdate = (e) => {
      const areas = (e && e.detail) || null;
      if (Array.isArray(areas)) setOutlets(areas);
      else loadOutletsFromLocal();
    };

    window.addEventListener('egg:outlets-updated', onUpdate);
    const onStorage = (evt) => {
      if (evt.key === STORAGE_KEY) onUpdate();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('egg:outlets-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!outlets || outlets.length === 0) return;
    setRows((prevRows) =>
      prevRows.map((r) => {
        const newOutlets = {};
        outlets.forEach((name) => {
          newOutlets[name] = (r.outlets && r.outlets[name]) || 0;
        });
        const total = Object.values(newOutlets).reduce((s, v) => s + Number(v || 0), 0);
        return { ...r, outlets: newOutlets, total };
      })
    );
  }, [outlets]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("dailySales", JSON.stringify(rows));
    }
  }, [rows, isLoaded]);

  const blockeddates = rows.map(row => row.date);

  const addrow = (newrow) => {
    setRows(prev => [newrow, ...prev]);
  };

  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex">
      <div className='w-full'>
        <div className='bg-eggWhite min-h-full p-4 w-full max-w-[1200px] overflow-x-hidden mx-auto'>
          <Dailyheader />
          <DailyTable rows={rows} outlets={outlets} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="md:col-span-2">
              <Dailyentryform addrow={addrow} blockeddates={blockeddates} outlets={outlets} />
            </div>

            <div className="flex flex-col">
              <Weeklytrend />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dailysales;
