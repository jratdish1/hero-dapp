import { useState } from "react";

interface SlippageSelectorProps {
  value: number;
  onChange: (val: number) => void;
}

const PRESETS = [0.1, 0.5, 1.0, 3.0];

export function SlippageSelector({ value, onChange }: SlippageSelectorProps) {
  const [custom, setCustom] = useState("");

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400">Slippage:</span>
      {PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => { onChange(p); setCustom(""); }}
          className={`px-2 py-1 rounded ${
            value === p && !custom ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {p}%
        </button>
      ))}
      <input
        type="number"
        min="0.01"
        max="50"
        step="0.1"
        placeholder="Custom"
        value={custom}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setCustom(e.target.value);
          if (!isNaN(v) && v > 0 && v <= 50) onChange(v);
        }}
        className="w-16 px-1 py-1 rounded bg-gray-700 text-white text-center"
      />
    </div>
  );
}

export default SlippageSelector;
