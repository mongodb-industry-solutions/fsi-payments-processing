'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import styles from './DynamicPaymentForm.module.css';
import paymentBuilderService from '../../services/paymentBuilderService';
import { useDebounce } from '../../utils/performanceUtils';
import AmountInput from './fields/AmountInput';
import CountrySelector from './fields/CountrySelector';
import TextInput from './fields/TextInput';
import SelectInput from './fields/SelectInput';
import TextAreaInput from './fields/TextAreaInput';
import SkeletonLoader from './SkeletonLoader';

function DynamicPaymentForm({
  paymentType,
  onFormChange,
  onFormValid,
  formData,
  setFormData
}) {
  const [formSchema, setFormSchema] = useState(null);
  const [validation, setValidation] = useState({});
  const [loading, setLoading] = useState(false);
  const [demoValues, setDemoValues] = useState(null);

  const fetchFormSchema = useCallback(async () => {
    setLoading(true);
    try {
      const schema = await paymentBuilderService.getFormSchema(paymentType.id, false);
      setFormSchema(schema.form_schema);

      // Initialize form data with empty values
      const initialData = {};
      schema.form_schema?.sections?.forEach(section => {
        section.fields?.forEach(field => {
          initialData[field.id] = '';
        });
      });
      setFormData(initialData);
    } catch (error) {
      console.error('Error fetching form schema:', error);
    } finally {
      setLoading(false);
    }
  }, [paymentType?.id, setFormData]);

  // Fetch form schema when payment type changes
  useEffect(() => {
    if (paymentType) {
      fetchFormSchema();
    }
  }, [paymentType, fetchFormSchema]);

  // Debounce validation for performance
  const debouncedFormData = useDebounce(formData, 300);

  const findFieldById = useCallback((fieldId) => {
    for (const section of formSchema?.sections || []) {
      const field = section.fields?.find(f => f.id === fieldId);
      if (field) return field;
    }
    return null;
  }, [formSchema]);

  const validateField = useCallback((fieldId, value) => {
    const field = findFieldById(fieldId);
    if (!field) return;

    let error = '';

    if (field.required && !value) {
      error = `${field.label} is required`;
    } else if (field.pattern) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(value)) {
        error = `Invalid format for ${field.label}`;
      }
    } else if (field.type === 'number' && value && isNaN(value)) {
      error = `${field.label} must be a number`;
    }

    setValidation(prev => ({
      ...prev,
      [fieldId]: error
    }));
  }, [findFieldById]);

  const validateForm = useCallback((data) => {
    let isValid = true;

    formSchema?.sections?.forEach(section => {
      section.fields?.forEach(field => {
        if (field.required && !data[field.id]) {
          isValid = false;
        }
      });
    });

    onFormValid(isValid);
    return isValid;
  }, [formSchema, onFormValid]);

  const handleFieldChange = useCallback((fieldId, value) => {
    const newData = { ...formData, [fieldId]: value };
    setFormData(newData);
    onFormChange(newData);
    validateField(fieldId, value);
    validateForm(newData);
  }, [formData, onFormChange, validateField, validateForm, setFormData]);

  const loadDemoValues = useCallback(async () => {
    try {
      const demo = await paymentBuilderService.getDemoValues(paymentType.id);
      if (demo.demo_values) {
        setFormData(demo.demo_values);
        setDemoValues(demo.demo_values);
        onFormChange(demo.demo_values);
        validateForm(demo.demo_values);
      }
    } catch (error) {
      console.error('Error loading demo values:', error);
    }
  }, [paymentType?.id, setFormData, onFormChange, validateForm]);

  const renderField = useCallback((field) => {
    const value = formData[field.id] || '';
    const error = validation[field.id];

    switch (field.type) {
      case 'text':
        return (
          <TextInput
            key={field.id}
            field={field}
            value={value}
            onChange={(val) => handleFieldChange(field.id, val)}
            error={error}
          />
        );

      case 'number':
        if (field.id === 'amount') {
          return (
            <AmountInput
              key={field.id}
              field={field}
              value={value}
              onChange={(val) => handleFieldChange(field.id, val)}
              error={error}
              currency={formData.currency || 'USD'}
            />
          );
        }
        return (
          <TextInput
            key={field.id}
            field={field}
            value={value}
            onChange={(val) => handleFieldChange(field.id, val)}
            error={error}
            type="number"
          />
        );

      case 'select':
        if (field.id.includes('country')) {
          return (
            <CountrySelector
              key={field.id}
              field={field}
              value={value}
              onChange={(val) => handleFieldChange(field.id, val)}
              error={error}
              countries={field.options}
            />
          );
        }
        return (
          <SelectInput
            key={field.id}
            field={field}
            value={value}
            onChange={(val) => handleFieldChange(field.id, val)}
            error={error}
            options={field.options}
          />
        );

      case 'textarea':
        return (
          <TextAreaInput
            key={field.id}
            field={field}
            value={value}
            onChange={(val) => handleFieldChange(field.id, val)}
            error={error}
          />
        );

      default:
        return (
          <TextInput
            key={field.id}
            field={field}
            value={value}
            onChange={(val) => handleFieldChange(field.id, val)}
            error={error}
          />
        );
    }
  }, [formData, validation, handleFieldChange]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading form schema...</p>
      </div>
    );
  }

  if (!formSchema) {
    return (
      <div className={styles.noSchema}>
        <p>No form schema available</p>
        <button onClick={fetchFormSchema} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <div className={styles.formHeader}>
        <h3>Form Fields</h3>
        <button
          onClick={loadDemoValues}
          className={styles.loadDemoButton}
        >
          Load Example Values
        </button>
      </div>

      <div className={styles.formContent}>
        {loading ? (
          <SkeletonLoader />
        ) : (
          formSchema.sections?.map((section, index) => (
            <div key={index} className={styles.formSection}>
              <h4 className={styles.sectionTitle}>{section.title}</h4>
              <div className={styles.fieldsGrid}>
                {section.fields?.map(field => renderField(field))}
              </div>
            </div>
          ))
        )}
      </div>

      {demoValues && (
        <div className={styles.demoIndicator}>
          <span className={styles.demoIcon}>✓</span>
          Demo values loaded
        </div>
      )}
    </div>
  );
}

// Export memoized component for performance
export default memo(DynamicPaymentForm);