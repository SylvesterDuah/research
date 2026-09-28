const currentYear = String(new Date().getFullYear());

document.querySelectorAll<HTMLElement>('[data-current-year]').forEach((yearElement) => {
  yearElement.textContent = currentYear;
});