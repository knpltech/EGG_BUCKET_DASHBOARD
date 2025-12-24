import React, { useState, useEffect } from 'react';

const Dailyentryform = ({ addrow, blockeddates, outlets }) => {
  const [date, setDate] = useState("");
  const [values, setValues] = useState(() => {
    const init = {};
    outlets.forEach((o) => (init[o] = ""));
    return init;
  });

  useEffect(() => {
    setValues(() => {
      const init = {};
      outlets.forEach((o) => (init[o] = ""));
      return init;
    });
  }, [outlets]);

  const handleSubmit = () => {
    if (!date) return alert("Date is required");
    if (blockeddates.includes(date)) return alert("Entry for this date already exists");

    // require all outlets to have values
    for (const o of outlets) {
      if (values[o] === "") return alert("All data is required");
    }

    const outletValues = {};
    outlets.forEach((o) => (outletValues[o] = Number(values[o] || 0)));

    const total = Object.values(outletValues).reduce((s, v) => s + Number(v || 0), 0);

    addrow({ date, outlets: outletValues, total });

    setDate("");
    setValues(() => {
      const init = {};
      outlets.forEach((o) => (init[o] = ""));
      return init;
    });
  };

  return (
    <div className="bg-white shadow rounded-xl p-4 m-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">Daily Sales Entry</h1>
        <button className="px-3 py-1 text-xs border rounded-lg">New Entry</button>
      </div>

      <div>
        <label className="text-gray-600 text-xs">Select Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-lg w-full p-2 mt-1 text-sm"
        />
      </div>

      {date && (
        <p className={`text-xs mt-1 ${blockeddates.includes(date) ? "text-red-600" : "text-green-600"}`}>
          {blockeddates.includes(date) ? "Date already exists" : "Date available"}
        </p>
      )}

      {/* Outlets */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-sm">
        {outlets.map((label) => (
          <div key={label}>
            <label className="text-gray-600 text-xs">{label}</label>
            <input
              type="number"
              value={values[label]}
              onChange={(e) => setValues((prev) => ({ ...prev, [label]: e.target.value }))}
              className="border p-2 rounded-lg w-full text-sm"
            />
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSubmit}
          className="bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-semibold w-full md:w-auto"
        >
          Save Entry
        </button>
      </div>
    </div>
  );
};

export default Dailyentryform;
