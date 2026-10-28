const publicBackend = '';
const onGitHubPages = /\.github\.io$/i.test(window.location.hostname);
window.ZDOS_CONFIG = { apiBase: onGitHubPages ? publicBackend : '' };
