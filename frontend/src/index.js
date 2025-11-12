import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// ✅ Add this before rendering
const resizeObserverErr = /ResizeObserver loop completed/;
const resizeObserverLimit = /ResizeObserver loop limit exceeded/;

window.addEventListener("error", (e) => {
  if (resizeObserverErr.test(e.message) || resizeObserverLimit.test(e.message)) {
    e.stopImmediatePropagation();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
