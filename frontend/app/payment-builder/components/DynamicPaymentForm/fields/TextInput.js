import styles from './Fields.module.css';

export default function TextInput({ field, value, onChange, error, type = 'text' }) {
  return (
    <div className={styles.fieldContainer}>
      <label htmlFor={field.id} className={styles.label}>
        {field.label}
        {field.required && <span className={styles.required} aria-label="required">*</span>}
      </label>
      <input
        id={field.id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        pattern={field.pattern}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        required={field.required}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `${field.id}-error` : undefined}
      />
      {error && <span id={`${field.id}-error`} className={styles.errorText} role="alert">{error}</span>}
    </div>
  );
}