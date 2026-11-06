// Relais : chaque requête part telle quelle vers le Worker d'origine (même chemin, même hôte), qui sert le site, l'API et le MCP.
export default { fetch: (request, env) => env.ORIGIN.fetch(request) };
