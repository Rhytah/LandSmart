import { useState, useCallback } from "react";

let addToastFn = null;

export function useToast() {
  const toast = useCallback((message, type = "info") => {
    if (addToastFn) addToastFn(message, type);
  }, []);
  return toast;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  addToastFn = (message, type) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const icons = { success: "✓", error: "✕", info: "○" };

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{icons[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
