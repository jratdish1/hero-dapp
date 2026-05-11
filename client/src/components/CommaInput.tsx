/**
 * CommaInput — Number input that displays commas for readability.
 * 
 * Shows "1,234,567.89" while user types, but stores the raw numeric
 * string (no commas) in state for contract calls.
 * 
 * Usage:
 *   <CommaInput value={amount} onChange={setAmount} placeholder="0.00" />
 */
import { useCallback } from "react";
import { Input } from "@/components/ui/input";

interface CommaInputProps {
  value: string;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/** Strip commas to get raw numeric string */
function stripCommas(s: string): string {
  return s.replace(/,/g, "");
}

/** Format a numeric string with commas every 3 digits (integer part only) */
function addCommas(raw: string): string {
  if (!raw) return "";
  const stripped = stripCommas(raw);
  
  // Allow empty, single minus, or just a dot while typing
  if (stripped === "" || stripped === ".") return stripped;
  
  const parts = stripped.split(".");
  const intPart = parts[0];
  const decPart = parts.length > 1 ? parts[1] : null;
  
  // Format integer part with commas
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  
  return decPart !== null ? `${formatted}.${decPart}` : formatted;
}

export function CommaInput({
  value,
  onChange,
  placeholder = "0.00",
  className = "",
  disabled = false,
  id,
}: CommaInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      // Strip commas and validate it's a valid number pattern
      const raw = stripCommas(input);
      // Allow: empty, digits, one dot, one leading minus
      if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
        onChange(raw);
      }
    },
    [onChange]
  );

  return (
    <Input
      type="text"
      inputMode="decimal"
      id={id}
      placeholder={placeholder}
      value={addCommas(value)}
      onChange={handleChange}
      className={className}
      disabled={disabled}
      autoComplete="off"
    />
  );
}

export default CommaInput;
