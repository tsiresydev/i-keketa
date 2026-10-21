const TOKEN_STORAGE_KEY = 'i-keketa.session.token';

/**
 * Le jeton de session est conservé dans le localStorage pour survivre aux
 * rechargements. Ce choix évite l'usage de cookies (donc pas de risque CSRF) ;
 * il suppose que le front respecte scrupuleusement la protection contre le
 * XSS (React échappe le texte, aucune insertion de HTML brut).
 */
export const sessionStorage = {
  getToken: (): string | null => {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  setToken: (token: string): void => {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      /* stockage indisponible (navigation privée) — la session reste en mémoire */
    }
  },

  clearToken: (): void => {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};
