const publicBackend = 'https://zdoskira-hpmsv6gt.manus.space';
const onGitHubPages = /\.github\.io$/i.test(window.location.hostname);
window.ZDOS_CONFIG = { apiBase: onGitHubPages ? publicBackend : '' };
