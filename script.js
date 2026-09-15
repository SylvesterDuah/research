document.addEventListener('DOMContentLoaded', () => {
  const sections = [...document.querySelectorAll('.chapter')];
  const navLinks = [...document.querySelectorAll('.topic-list a, .toc a')];

  const activateLink = (id) => {
    navLinks.forEach((link) => {
      const matched = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('active', matched);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible) {
        activateLink(visible.target.id);
      }
    },
    { rootMargin: '-10% 0px -65% 0px', threshold: [0.15, 0.4, 0.8] }
  );

  sections.forEach((section) => observer.observe(section));

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const id = link.getAttribute('href')?.replace('#', '');
      if (id) activateLink(id);
    });
  });
});
