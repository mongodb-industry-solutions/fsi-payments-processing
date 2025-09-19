import { useState, useMemo, useCallback, useRef, useEffect, lazy } from 'react';

/**
 * Custom hook for debouncing values
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for throttling function calls
 */
export function useThrottle(callback, delay = 1000) {
  const lastRun = useRef(Date.now());

  return useCallback((...args) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);
}

/**
 * Memoization helper for expensive computations
 */
export function memoize(fn) {
  const cache = new Map();

  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Virtual scrolling helper for large lists
 */
export function useVirtualScroll(items, itemHeight, containerHeight) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e) => setScrollTop(e.target.scrollTop)
  };
}

/**
 * Lazy loading wrapper for components
 */
export function lazyWithPreload(importFunc) {
  const Component = lazy(importFunc);
  Component.preload = importFunc;
  return Component;
}

/**
 * Request animation frame wrapper for smooth animations
 */
export function rafSchedule(callback) {
  let scheduled = false;

  return function(...args) {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        callback.apply(this, args);
      });
    }
  };
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  ref,
  options = { threshold: 0.1, rootMargin: '100px' }
) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, options]);

  return isIntersecting;
}

/**
 * Performance monitoring helper
 */
export class PerformanceMonitor {
  constructor(name) {
    this.name = name;
    this.marks = new Map();
  }

  start(label) {
    performance.mark(`${this.name}-${label}-start`);
    this.marks.set(label, performance.now());
  }

  end(label) {
    const startTime = this.marks.get(label);
    if (startTime) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      performance.mark(`${this.name}-${label}-end`);
      performance.measure(
        `${this.name}-${label}`,
        `${this.name}-${label}-start`,
        `${this.name}-${label}-end`
      );

      if (process.env.NODE_ENV === 'development') {
        console.log(`[${this.name}] ${label}: ${duration.toFixed(2)}ms`);
      }

      this.marks.delete(label);
      return duration;
    }
    return 0;
  }

  clear() {
    this.marks.clear();
  }
}

/**
 * Batch DOM updates for better performance
 */
export function batchedUpdates(updates) {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
}

/**
 * Web Worker helper for offloading heavy computations
 */
export class WorkerPool {
  constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
    this.workers = [];
    this.queue = [];
    this.poolSize = poolSize;

    for (let i = 0; i < poolSize; i++) {
      this.workers.push({
        worker: new Worker(workerScript),
        busy: false
      });
    }
  }

  execute(data) {
    return new Promise((resolve, reject) => {
      const availableWorker = this.workers.find(w => !w.busy);

      if (availableWorker) {
        this.runWorker(availableWorker, data, resolve, reject);
      } else {
        this.queue.push({ data, resolve, reject });
      }
    });
  }

  runWorker(workerObj, data, resolve, reject) {
    workerObj.busy = true;

    workerObj.worker.onmessage = (e) => {
      resolve(e.data);
      workerObj.busy = false;

      if (this.queue.length > 0) {
        const { data, resolve, reject } = this.queue.shift();
        this.runWorker(workerObj, data, resolve, reject);
      }
    };

    workerObj.worker.onerror = (error) => {
      reject(error);
      workerObj.busy = false;
    };

    workerObj.worker.postMessage(data);
  }

  terminate() {
    this.workers.forEach(w => w.worker.terminate());
  }
}