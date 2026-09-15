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

if (likeButton && likeCount) {
  const likeStorageKey = 'research-blog-like-state';
  const defaultLikeState = { liked: false, likes: 128 };

  const readLikeState = (): { liked: boolean; likes: number } => {
    try {
      const saved = localStorage.getItem(likeStorageKey);
      if (!saved) return defaultLikeState;

      const parsed = JSON.parse(saved) as Partial<typeof defaultLikeState>;
      return {
        liked: Boolean(parsed.liked),
        likes: Number.isFinite(parsed.likes) ? Number(parsed.likes) : defaultLikeState.likes,
      };
    } catch {
      return defaultLikeState;
    }
  };

  const saveLikeState = (state: { liked: boolean; likes: number }): void => {
    localStorage.setItem(likeStorageKey, JSON.stringify(state));
  };

  const syncLikeButton = (liked: boolean, count: number) => {
    likeButton.classList.toggle('liked', liked);
    likeButton.setAttribute('aria-pressed', String(liked));
    const heart = likeButton.querySelector('.heart');
    if (heart) {
      heart.textContent = liked ? '♥' : '♡';
    }
    likeCount.textContent = String(count);
  };

  const initialState = readLikeState();
  syncLikeButton(initialState.liked, initialState.likes);

  likeButton.addEventListener('click', () => {
    const currentState = readLikeState();
    const nextState = {
      liked: !currentState.liked,
      likes: currentState.liked ? Math.max(0, currentState.likes - 1) : currentState.likes + 1,
    };
    saveLikeState(nextState);
    syncLikeButton(nextState.liked, nextState.likes);
  });
}
