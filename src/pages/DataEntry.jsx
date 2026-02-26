const API_URL = import.meta.env.VITE_API_URL;
import { useState, useEffect, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore,
  faCalendarDays,
  faFileInvoiceDollar,
  faIndianRupeeSign,
  faPaperPlane,
  faWallet,
  faMoneyBillWave,
  faLock,
} from "@fortawesome/free-solid-svg-icons";

export default function DataEntry() {
  // Outlets state
  const [outlets, setOutlets] = useState([]);
  const [isLoadingOutlets, setIsLoadingOutlets] = useState(true);
  
  // Existing entries state (for lock feature)
  const [existingEntries, setExistingEntries] = useState([]);
  
  // Form state
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  
  // Sales Details
  const [salesQty, setSalesQty] = useState("");
  const [neccRate, setNeccRate] = useState("");
  const [dailyDamage, setDailyDamage] = useState("");
  
  // Collection Details
  const [digitalPayment, setDigitalPayment] = useState("");
  const [cashPayment, setCashPayment] = useState("");

  // Fetch outlets from API
  const fetchOutlets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/outlets/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Sort outlets by name and filter active only
          const sorted = data
            .filter(o => o.status === "Active")
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          setOutlets(sorted);
        }
      }
    } catch (err) {
      console.error("Error fetching outlets:", err);
    } finally {
      setIsLoadingOutlets(false);
    }
  }, []);

  // Fetch existing entries (for lock feature)
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/data-entry/all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setExistingEntries(data);
        }
      }
    } catch (err) {
      // API might not exist yet - that's okay
      console.log("Data entry API not available yet");
    }
  }, []);

  useEffect(() => {
    fetchOutlets();
    fetchEntries();
  }, [fetchOutlets, fetchEntries]);

  // Check if entry already exists for selected outlet + date
  const hasEntry = useMemo(() => {
    if (!selectedOutlet || !date) return false;
    return existingEntries.some(
      entry => entry.outletId === selectedOutlet && entry.date === date
    );
  }, [selectedOutlet, date, existingEntries]);

  // Get existing entry data if locked
  const existingEntry = useMemo(() => {
    if (!hasEntry) return null;
    return existingEntries.find(
      entry => entry.outletId === selectedOutlet && entry.date === date
    );
  }, [hasEntry, selectedOutlet, date, existingEntries]);

  // Load existing values when entry is locked
  useEffect(() => {
    if (existingEntry) {
      setSalesQty(existingEntry.salesQty?.toString() || "");
      setNeccRate(existingEntry.neccRate?.toString() || "");
      setDailyDamage(existingEntry.dailyDamage?.toString() || "");
      setDigitalPayment(existingEntry.digitalPayment?.toString() || "");
      setCashPayment(existingEntry.cashPayment?.toString() || "");
    } else if (selectedOutlet && date && !hasEntry) {
      // Reset fields for new entry
      setSalesQty("");
      setNeccRate("");
      setDailyDamage("");
      setDigitalPayment("");
      setCashPayment("");
    }
  }, [existingEntry, selectedOutlet, date, hasEntry]);

  // Calculations
  const totalSalesAmount = (parseFloat(salesQty) || 0) * (parseFloat(neccRate) || 0);
  const totalReceivedAmount = (parseFloat(digitalPayment) || 0) + (parseFloat(cashPayment) || 0);
  const differenceAmount = totalReceivedAmount - totalSalesAmount;

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Submit handler - saves to all respective collections
  const handleSubmit = async () => {
    if (!selectedOutlet || !date || hasEntry) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/data-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutlet,
          date,
          salesQty: parseFloat(salesQty) || 0,
          neccRate: parseFloat(neccRate) || 0,
          dailyDamage: parseFloat(dailyDamage) || 0,
          digitalPayment: parseFloat(digitalPayment) || 0,
          cashPayment: parseFloat(cashPayment) || 0,
          totalSalesAmount,
          totalReceivedAmount,
          differenceAmount,
        }),
      });
      
      if (response.ok) {
        // Refresh entries to update lock status
        fetchEntries();
        alert("Data entry saved successfully!");
      } else {
        const error = await response.json();
        alert(error.message || "Failed to save entry");
      }
    } catch (err) {
      console.error("Error saving entry:", err);
      alert("Failed to save entry. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset all fields
  const handleReset = () => {
    setSelectedOutlet("");
    setDate(new Date().toISOString().split("T")[0]);
    setSalesQty("");
    setNeccRate("");
    setDailyDamage("");
    setDigitalPayment("");
    setCashPayment("");
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-800">Data Entry</h1>
          <p className="text-gray-500 text-sm">Enter daily sales and collection data</p>
        </div>

        {/* Header Row: Outlet + Date */}
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Outlet Selection */}
            <div>
              <label className="flex items-center gap-2 text-gray-700 text-sm font-medium mb-2">
                <FontAwesomeIcon icon={faStore} className="text-orange-500" />
                Outlet Name
              </label>
              <select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                className="w-full bg-white border-2 border-orange-400 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
                disabled={isLoadingOutlets}
              >
                <option value="">Select outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id || outlet.name} value={outlet.id || outlet.name}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-gray-700 text-sm font-medium mb-2">
                <FontAwesomeIcon icon={faCalendarDays} className="text-orange-500" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
          
          {/* Locked Indicator */}
          {hasEntry && (
            <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">
                <FontAwesomeIcon icon={faLock} className="mr-1" />
                Entry exists for this outlet & date • Locked
              </span>
            </div>
          )}
        </div>

        {/* Sales Details Section */}
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-gray-800 font-semibold text-lg">
              <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-orange-500" />
              Sales Details
            </h2>
            <p className="text-gray-500 text-sm mt-1">Enter your sales information</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sales Quantity */}
            <div>
              <label className="text-gray-700 text-sm font-medium mb-2 block">
                Sales Quantity
              </label>
              <input
                type="number"
                placeholder="0"
                value={salesQty}
                onChange={(e) => setSalesQty(e.target.value)}
                disabled={hasEntry}
                className={`w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${hasEntry ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              />
            </div>
            
            {/* NECC Rate */}
            <div>
              <label className="text-gray-700 text-sm font-medium mb-2 block">
                NECC Rate
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={neccRate}
                onChange={(e) => setNeccRate(e.target.value)}
                disabled={hasEntry}
                className={`w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${hasEntry ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>
          
          {/* Daily Damage */}
          <div className="mt-4">
            <label className="text-gray-700 text-sm font-medium mb-2 block">
              Daily Damage
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={dailyDamage}
              onChange={(e) => setDailyDamage(e.target.value)}
              disabled={hasEntry}
              className={`w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${hasEntry ? 'bg-gray-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>

        {/* Collection Details Section */}
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-gray-800 font-semibold text-lg">
              <FontAwesomeIcon icon={faIndianRupeeSign} className="text-orange-500" />
              Collection Details
            </h2>
          </div>
          
          {/* Digital Payment */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-gray-700 text-sm font-medium mb-2">
              <FontAwesomeIcon icon={faWallet} className="text-gray-400" />
              Digital Payment (Online)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={digitalPayment}
              onChange={(e) => setDigitalPayment(e.target.value)}
              disabled={hasEntry}
              className={`w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${hasEntry ? 'bg-gray-50 cursor-not-allowed' : ''}`}
            />
          </div>
          
          {/* Cash Payment */}
          <div>
            <label className="flex items-center gap-2 text-gray-700 text-sm font-medium mb-2">
              <FontAwesomeIcon icon={faMoneyBillWave} className="text-gray-400" />
              Cash Payment
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={cashPayment}
              onChange={(e) => setCashPayment(e.target.value)}
              disabled={hasEntry}
              className={`w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${hasEntry ? 'bg-gray-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleSubmit}
            disabled={hasEntry || !selectedOutlet || isSaving}
            className={`flex-1 rounded-xl py-3 font-medium flex items-center justify-center gap-2 transition-colors shadow-lg ${
              hasEntry 
                ? 'bg-gray-400 cursor-not-allowed text-white' 
                : !selectedOutlet || isSaving
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={hasEntry ? faLock : faPaperPlane} />
                {hasEntry ? 'Locked' : 'Submit Entry'}
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            disabled={hasEntry || isSaving}
            className={`flex-1 rounded-xl py-3 font-medium flex items-center justify-center gap-2 transition-colors shadow-lg ${
              hasEntry || isSaving
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-gray-100 hover:bg-gray-200 text-orange-500 border border-orange-400'
            }`}
          >
            Reset
          </button>
        </div>

        {/* Calculated Results Section */}
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
          <h2 className="text-gray-800 font-semibold text-lg mb-4">Calculated Results</h2>
          
          <div className="space-y-3">
            {/* Total Sales Amount */}
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-red-700 font-medium">Total Sales Amount</p>
                <p className="text-red-500 text-sm">Qty × Rate</p>
              </div>
              <p className="text-red-700 font-bold text-xl">
                ₹{formatCurrency(totalSalesAmount)}
              </p>
            </div>
            
            {/* Total Received Amount */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-green-700 font-medium">Total Received Amount</p>
                <p className="text-green-500 text-sm">Online + Collections</p>
              </div>
              <p className="text-green-700 font-bold text-xl">
                ₹{formatCurrency(totalReceivedAmount)}
              </p>
            </div>
            
            {/* Difference Amount */}
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
              differenceAmount >= 0 
                ? "bg-green-50 border border-green-200" 
                : "bg-orange-50 border border-orange-200"
            }`}>
              <div>
                <p className={differenceAmount >= 0 ? "text-green-700 font-medium" : "text-orange-700 font-medium"}>
                  Difference Amount
                </p>
                <p className={differenceAmount >= 0 ? "text-green-500 text-sm" : "text-orange-500 text-sm"}>
                  Received - Sales
                </p>
              </div>
              <p className={`font-bold text-xl ${
                differenceAmount >= 0 ? "text-green-700" : "text-orange-700"
              }`}>
                ₹{formatCurrency(differenceAmount)}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
