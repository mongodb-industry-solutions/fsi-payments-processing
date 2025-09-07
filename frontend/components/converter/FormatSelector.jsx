"use client";

import styles from "./FormatSelector.module.css";

export default function FormatSelector({ label, value, onChange, options, placeholder, disabled }) {
  return (
    <div className={styles.selectorContainer}>
      <label className={styles.label}>{label}</label>
      <select 
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder || "Select format..."}</option>
        {options && options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}