import './style.css';

type ModeratedComment = {
  id: number;
  name: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const authForm = document.querySelector<HTMLFormElement>('#admin-auth-form');
const tokenInput = document.querySelector<HTMLInputElement>('#admin-token');
const notice = document.querySelector<HTMLElement>('#admin-notice');
const section = document.querySelector<HTMLElement>('#moderation-section');
const list = document.querySelector<HTMLElement>('#moderation-list');
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh-comments');
let adminToken = sessionStorage.getItem('admin-token') || '';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const request = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error((await response.json().catch(() => null))?.error || 'Request failed');
  }
  return response.status === 204 ? (undefined as T) : (await response.json()) as T;
};

const formatDate = (value: string): string => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const renderComments = (comments: ModeratedComment[]): void => {
  if (!list) return;
  if (comments.length === 0) {
    list.innerHTML = '<p class="empty-state">No comments in the moderation queue.</p>';
    return;
  }

  list.innerHTML = comments.map((comment) => `
    <article class="moderation-card" data-comment-id="${comment.id}">
      <div class="moderation-card-header">
        <div>
          <strong>${escapeHtml(comment.name)}</strong>
          <span>${escapeHtml(formatDate(comment.createdAt))}</span>
        </div>
        <span class="status-pill status-${comment.status}">${comment.status}</span>
      </div>
      <p>${escapeHtml(comment.message).replace(/\n/g, '<br>')}</p>
      <div class="moderation-actions">
        <button class="admin-action-button approve" type="button" data-status="approved">Approve</button>
        <button class="admin-action-button reject" type="button" data-status="rejected">Reject</button>
        <button class="admin-action-button delete" type="button" data-delete="true">Delete</button>
      </div>
    </article>
  `).join('');
};

const loadComments = async (): Promise<void> => {
  try {
    const comments = await request<ModeratedComment[]>('/api/admin/comments');
    renderComments(comments);
    if (section) section.hidden = false;
    if (notice) notice.textContent = `${comments.length} comment${comments.length === 1 ? '' : 's'} loaded.`;
  } catch (error) {
    if (notice) notice.textContent = error instanceof Error ? error.message : 'Could not load comments.';
  }
};

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  adminToken = tokenInput?.value.trim() || '';
  sessionStorage.setItem('admin-token', adminToken);
  await loadComments();
});

refreshButton?.addEventListener('click', () => void loadComments());

list?.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('button[data-status], button[data-delete]');
  const card = target.closest<HTMLElement>('[data-comment-id]');
  if (!button || !card) return;

  try {
    const id = card.dataset.commentId;
    if (button.dataset.delete === 'true') {
      await request(`/api/admin/comments/${id}`, { method: 'DELETE' });
    } else {
      await request(`/api/admin/comments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: button.dataset.status }),
      });
    }
    await loadComments();
  } catch (error) {
    if (notice) notice.textContent = error instanceof Error ? error.message : 'Could not update comment.';
  }
});

if (adminToken) {
  void loadComments();
}
