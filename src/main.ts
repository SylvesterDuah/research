import './style.css';

const sections = Array.from(document.querySelectorAll<HTMLElement>('.chapter'));
const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.topic-list a, .toc a'));

const activateLink = (id: string): void => {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('active', isActive);
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
    if (id) {
      activateLink(id);
    }
  });
});

const likeButton = document.querySelector<HTMLButtonElement>('.like-button');
const likeCount = document.querySelector<HTMLElement>('.like-count');

const fetchJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }

  return (await response.json()) as T;
};

if (likeButton && likeCount) {
  const syncLikeButton = (liked: boolean, count: number) => {
    likeButton.classList.toggle('liked', liked);
    likeButton.setAttribute('aria-pressed', String(liked));
    const heart = likeButton.querySelector('.heart');
    if (heart) {
      heart.textContent = liked ? '♥' : '♡';
    }
    likeCount.textContent = String(count);
  };

  const loadLikeState = async () => {
    try {
      const state = await fetchJson<{ liked: boolean; likes: number }>('/api/likes');
      syncLikeButton(state.liked, state.likes);
    } catch (error) {
      console.error('Failed to load likes', error);
    }
  };

  likeButton.addEventListener('click', async () => {
    try {
      const state = await fetchJson<{ liked: boolean; likes: number }>('/api/likes/toggle', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      syncLikeButton(state.liked, state.likes);
    } catch (error) {
      console.error('Failed to toggle like', error);
    }
  });

  void loadLikeState();
}
