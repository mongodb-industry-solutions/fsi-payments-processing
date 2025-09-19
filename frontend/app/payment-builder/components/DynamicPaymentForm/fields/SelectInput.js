import styles from './Fields.module.css';

export default function SelectInput({ field, value, onChange, error, options }) {
  return (
    <div className={styles.fieldContainer}>
      <label htmlFor={field.id} className={styles.label}>
        {field.label}
        {field.required && <span className={styles.required} aria-label="required">*</span>}
      </label>
      <select
        id={field.id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${styles.select} ${error ? styles.inputError : ''}`}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `${field.id}-error` : undefined}
      >
        <option value="">Select {field.label.toLowerCase()}</option>
        {options?.map((option, index) => {
          // Handle both string and object options
          const optionValue = typeof option === 'object' ? (option.value || option.code || JSON.stringify(option)) : option;
          const optionLabel = typeof option === 'object' ? (option.label || option.name || optionValue) : option;
          const optionKey = typeof option === 'object' ? `${field.id}_${index}_${optionValue}` : option;

          return (
            <option key={optionKey} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
      {error && <span id={`${field.id}-error`} className={styles.errorText} role="alert">{error}</span>}
    </div>
  );
}