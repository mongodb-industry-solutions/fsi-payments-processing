import styles from './Fields.module.css';

const countryFlags = {
  USA: '🇺🇸',
  UK: '🇬🇧',
  Germany: '🇩🇪',
  France: '🇫🇷',
  Japan: '🇯🇵',
  Canada: '🇨🇦',
  Australia: '🇦🇺',
  Switzerland: '🇨🇭',
  Netherlands: '🇳🇱',
  Italy: '🇮🇹'
};

export default function CountrySelector({ field, value, onChange, error, countries }) {
  const availableCountries = countries || Object.keys(countryFlags);

  return (
    <div className={styles.fieldContainer}>
      <label htmlFor={field.id} className={styles.label}>
        {field.label}
        {field.required && <span className={styles.required}>*</span>}
      </label>
      <select
        id={field.id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${styles.select} ${error ? styles.inputError : ''}`}
        required={field.required}
      >
        <option value="">Select a country</option>
        {availableCountries.map(country => (
          <option key={country} value={country}>
            {countryFlags[country]} {country}
          </option>
        ))}
      </select>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}