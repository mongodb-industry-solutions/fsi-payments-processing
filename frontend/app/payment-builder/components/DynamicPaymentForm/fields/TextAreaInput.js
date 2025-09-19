import styles from './Fields.module.css';

export default function TextAreaInput({ field, value, onChange, error }) {
  return (
    <div className={`${styles.fieldContainer} ${styles.fullWidth}`}>
      <label htmlFor={field.id} className={styles.label}>
        {field.label}
        {field.required && <span className={styles.required} aria-label="required">*</span>}
      </label>
      <textarea
        id={field.id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`${styles.textarea} ${error ? styles.inputError : ''}`}
        required={field.required}
        rows={3}
        aria-required={field.required}
        aria-invalid={!!error}
        aria-describedby={error ? `${field.id}-error` : `${field.id}-charcount`}
      />
      <div className={styles.textareaFooter}>
        {error && <span id={`${field.id}-error`} className={styles.errorText} role="alert">{error}</span>}
        <span id={`${field.id}-charcount`} className={styles.charCount} aria-live="polite">{value.length} characters</span>
      </div>
    </div>
  );
}