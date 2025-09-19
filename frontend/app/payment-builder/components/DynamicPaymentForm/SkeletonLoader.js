import styles from './SkeletonLoader.module.css';

export default function SkeletonLoader() {
  return (
    <div className={styles.skeletonContainer}>
      {/* Skeleton Section 1 */}
      <div className={styles.skeletonSection}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonFields}>
          <div className={styles.skeletonField}>
            <div className={styles.skeletonLabel} />
            <div className={styles.skeletonInput} />
          </div>
          <div className={styles.skeletonField}>
            <div className={styles.skeletonLabel} />
            <div className={styles.skeletonInput} />
          </div>
        </div>
      </div>

      {/* Skeleton Section 2 */}
      <div className={styles.skeletonSection}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonFields}>
          <div className={styles.skeletonField}>
            <div className={styles.skeletonLabel} />
            <div className={styles.skeletonInput} />
          </div>
          <div className={styles.skeletonField}>
            <div className={styles.skeletonLabel} />
            <div className={styles.skeletonSelect} />
          </div>
        </div>
      </div>

      {/* Skeleton Section 3 */}
      <div className={styles.skeletonSection}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonFields}>
          <div className={styles.skeletonFieldFull}>
            <div className={styles.skeletonLabel} />
            <div className={styles.skeletonTextarea} />
          </div>
        </div>
      </div>
    </div>
  );
}