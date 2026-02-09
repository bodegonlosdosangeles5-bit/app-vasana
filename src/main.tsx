import ReactGA from "react-ga4";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Inicialización de Google Analytics
const GA_ID = import.meta.env.VITE_GA_ID;

if (GA_ID) {
  ReactGA.initialize(GA_ID);
}

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registrado exitosamente:', registration);
        
        // Verificar actualizaciones
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nueva versión disponible
                if (confirm('Nueva versión disponible. ¿Recargar la página?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('Error al registrar SW:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);





