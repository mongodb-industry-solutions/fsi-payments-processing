import styles from './Fields.module.css';

export default function AmountInput({ field, value, onChange, error, currency }) {
  const formatAmount = (val) => {
    // Remove non-numeric characters except decimal point
    const cleaned = val.replace(/[^\d.]/g, '');
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  };

  const handleChange = (e) => {
    const formatted = formatAmount(e.target.value);
    onChange(formatted);
  };

  return (
    <div className={styles.fieldContainer}>
      <label htmlFor={field.id} className={styles.label}>
        {field.label}
        {field.required && <span className={styles.required}>*</span>}
      </label>
      <div className={styles.amountInputWrapper}>
        <span className={styles.currencyPrefix}>{currency}</span>
        <input
          id={field.id}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="0.00"
          className={`${styles.input} ${styles.amountInput} ${error ? styles.inputError : ''}`}
          required={field.required}
        />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}